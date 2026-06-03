import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { InvokeOptions, OutputBufferMode } from '../providers/interface.js';
import {
  DEFAULT_OUTPUT_BUFFER_BYTES,
  DEFAULT_OUTPUT_BUFFER_MODE,
  MAX_OUTPUT_BUFFER_BYTES,
  type OutputBufferPolicy,
} from '../providers/interface.js';
import { parseSentinel, type SentinelMeta } from './sentinel.js';
import { DEFAULT_PROVIDER_KILL_GRACE_MS } from '../runtime/provider-execution-control.js';
import { ProviderExecutionError } from '../runtime/provider-execution-error.js';
import { terminateProviderProcess } from '../runtime/provider-process.js';

export interface SpawnStreamConfig {
  /** Process name used in error messages, e.g. "gemini". */
  processName: string;
  /** Whether to pipe stdin (so it can be closed) or ignore it. */
  stdin: 'pipe' | 'ignore';
  /**
   * Path to a temp file whose contents are piped as stdin to the child process.
   * When set, the file is opened as a ReadStream and connected to the child's stdin.
   * The file is deleted (unlinked) after the child process exits — even on failure.
   * If this is set, `stdin` should be 'pipe'.
   */
  stdinFile?: string;
  /**
   * Explicit env object to pass to the child process.
   * If omitted, the child inherits process.env (legacy behavior).
   * Use buildProviderEnv() to construct an allowlist env.
   */
  env?: NodeJS.ProcessEnv;
  /**
   * Working directory for the child process.
   * If omitted, the child inherits the parent process cwd (legacy behavior).
   * Providers whose binary derives persistent state from cwd (e.g. agy registers
   * cwd as an Antigravity project) should pass a stable, neutral directory.
   */
  cwd?: string;
}

/**
 * Writes content to a temp file with mode 0o600 and returns its path.
 * The caller is responsible for cleanup (or use stdinFile in spawnStream which auto-cleans).
 */
export async function writeTempInput(content: string): Promise<string> {
  const name = `aco-input-${randomBytes(8).toString('hex')}`;
  const filePath = join(tmpdir(), name);
  await writeFile(filePath, content, { mode: 0o600, encoding: 'utf8' });
  return filePath;
}

export interface SpawnStreamOptions extends InvokeOptions {
  /** Callback invoked when a sentinel line is detected. */
  onSentinel?: (meta: SentinelMeta, rid: string) => void;
  /**
   * Called once with the full captured stderr after the child process closes.
   * Receives up to MAX_STDERR_CHARS of stderr content.
   */
  onStderrComplete?: (stderr: string) => void;
}

const MAX_STDERR_CHARS = 4_000;
const MAX_LAST_LINE_BUFFER_CHARS = 16 * 1024;
const VALID_OUTPUT_BUFFER_MODES: OutputBufferMode[] = ['stream-only', 'bounded', 'disabled'];

function normalizeOutputBufferPolicy(
  outputBuffer: OutputBufferPolicy | undefined
): Required<Pick<OutputBufferPolicy, 'mode' | 'maxBytes'>> {
  const mode: OutputBufferMode = outputBuffer?.mode ?? DEFAULT_OUTPUT_BUFFER_MODE;
  const maxBytes = outputBuffer?.maxBytes ?? DEFAULT_OUTPUT_BUFFER_BYTES;
  if (!VALID_OUTPUT_BUFFER_MODES.includes(mode)) {
    throw new Error(`Invalid outputBuffer.mode '${mode}'`);
  }

  if (mode !== 'bounded') {
    return { mode, maxBytes };
  }

  if (!Number.isFinite(maxBytes) || !Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Invalid outputBuffer.maxBytes: must be an integer >= 1 in bounded mode');
  }

  if (maxBytes > MAX_OUTPUT_BUFFER_BYTES) {
    throw new Error(`Invalid outputBuffer.maxBytes: exceeds max ${MAX_OUTPUT_BUFFER_BYTES} bytes`);
  }

  return { mode, maxBytes };
}

const trimToMaxBytes = (
  value: Buffer<ArrayBufferLike>,
  maxBytes: number
): Buffer<ArrayBufferLike> => {
  if (value.length <= maxBytes) return value;
  return Buffer.from(value.subarray(value.length - maxBytes));
};

const toBuffer = (chunk: Buffer | string): Buffer<ArrayBufferLike> => {
  return typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
};

/**
 * Spawns a child process and yields its stdout as string chunks.
 * Captures stderr so provider failures remain diagnosable.
 * Calls options.onPid once the process has a PID.
 *
 * Sentinel handling:
 * - Detects ACO_META_<rid>: lines at end of output
 * - Calls onSentinel callback when detected
 * - Strips rid from sentinel for backward compatibility
 */
export async function* spawnStream(
  binary: string,
  args: string[],
  config: SpawnStreamConfig,
  options?: SpawnStreamOptions
): AsyncIterable<string> {
  const outputBufferPolicy = normalizeOutputBufferPolicy(options?.outputBuffer);
  const outputBufferMode = outputBufferPolicy.mode;
  const outputBufferMaxBytes = outputBufferPolicy.maxBytes;
  const outputBufferSnapshot = options?.outputBuffer?.snapshot;
  const shouldCaptureOutput = outputBufferMode === 'bounded' && outputBufferSnapshot !== undefined;

  // stdinFile이 있으면 openSync로 fd를 열어 stdin에 연결한다.
  // ReadStream 객체는 spawn stdio에 직접 전달할 수 없으므로 fd를 사용한다.
  // env가 있으면 해당 allowlist env만 child에게 전달한다.

  /** stdinFile을 unlink한다. resolve/reject 이전에 await되어 cleanup이 보장된다. */
  const cleanupStdinFile = (): Promise<void> => {
    if (config.stdinFile) {
      return unlink(config.stdinFile).catch(() => {});
    }
    return Promise.resolve();
  };

  let stdinFd: number | undefined;
  if (config.stdinFile) {
    try {
      stdinFd = openSync(config.stdinFile, 'r');
    } catch (err) {
      await cleanupStdinFile();
      throw err;
    }
  }

  const stdinValue: 'ignore' | 'pipe' | number = stdinFd !== undefined ? stdinFd : config.stdin;

  // spawn은 옵션 검증 등으로 동기 throw가 가능하므로, 그 경우에도
  // stdinFd와 임시 파일이 누수되지 않도록 try/catch로 감싼다.
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(binary, args, {
      stdio: [stdinValue, 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      ...(config.env !== undefined && { env: config.env }),
      ...(config.cwd !== undefined && { cwd: config.cwd }),
    });
  } catch (err) {
    if (stdinFd !== undefined) {
      closeSync(stdinFd);
    }
    await cleanupStdinFile();
    throw err;
  }

  // fd는 spawn 호출 직후 닫는다 (child process가 상속한 fd를 계속 사용).
  if (stdinFd !== undefined) {
    closeSync(stdinFd);
  }

  if (child.pid !== undefined) {
    options?.onPid?.(child.pid);
  }

  let timedOut = false;
  let timeoutTimer: NodeJS.Timeout | undefined;
  let forceKillTimer: NodeJS.Timeout | undefined;

  const clearExecutionTimers = (): void => {
    if (timeoutTimer !== undefined) {
      clearTimeout(timeoutTimer);
      timeoutTimer = undefined;
    }
    if (forceKillTimer !== undefined) {
      clearTimeout(forceKillTimer);
      forceKillTimer = undefined;
    }
  };

  if (options?.timeoutMs !== undefined) {
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) {
        terminateProviderProcess(child.pid, 'SIGTERM');
        forceKillTimer = setTimeout(() => {
          if (child.pid !== undefined) {
            terminateProviderProcess(child.pid, 'SIGKILL');
          }
        }, options.killGraceMs ?? DEFAULT_PROVIDER_KILL_GRACE_MS);
      }
    }, options.timeoutMs);
  }

  // stdinFile이 없고 stdin='pipe'인 경우에만 직접 닫는다.
  // stdinFile이 있으면 ReadStream이 끝날 때 자동으로 닫힌다.
  if (!config.stdinFile && config.stdin === 'pipe' && child.stdin) {
    child.stdin.end();
  }

  let boundedOutput: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  const maxSnapshotBytes = outputBufferMaxBytes;

  const appendBoundedOutput = (chunk: Buffer<ArrayBufferLike>): void => {
    if (chunk.length >= maxSnapshotBytes) {
      boundedOutput = trimToMaxBytes(chunk, maxSnapshotBytes);
      return;
    }

    const combined = Buffer.concat([boundedOutput, chunk]);
    boundedOutput = trimToMaxBytes(combined, maxSnapshotBytes);
  };

  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer | string) => {
    if (stderr.length >= MAX_STDERR_CHARS) return;
    const text = typeof chunk === 'string' ? chunk : chunk.toString();
    stderr += text.slice(0, MAX_STDERR_CHARS - stderr.length);
  });

  if (!child.stdout) {
    await cleanupStdinFile();
    throw new Error(`${config.processName}: failed to open stdout pipe`);
  }

  const closePromise = new Promise<void>((resolve, reject) => {
    child.on('close', (code, signal) => {
      clearExecutionTimers();
      // cleanup을 완료한 뒤 resolve/reject한다.
      void cleanupStdinFile().then(() => {
        // stderr가 완전히 수집된 후 콜백을 호출한다.
        options?.onStderrComplete?.(stderr);

        if (timedOut) {
          reject(
            new ProviderExecutionError(
              'timeout',
              `${config.processName} timed out after ${Math.ceil((options?.timeoutMs ?? 0) / 1000)}s`
            )
          );
          return;
        }

        if (code !== 0 || signal !== null) {
          const reason =
            signal === null
              ? `${config.processName} exited with code ${code}`
              : `${config.processName} terminated by signal ${signal}`;
          const detail = stderr.trim();
          reject(new Error(detail ? `${reason}\n${detail}` : reason));
        } else {
          resolve();
        }
      });
    });
    child.on('error', (err) => {
      clearExecutionTimers();
      options?.onStderrComplete?.(stderr);
      void cleanupStdinFile().then(() => reject(err));
    });
  });
  closePromise.catch(() => {});

  // Track the last line to detect sentinel without buffering entire output
  let lastLineBuffer = '';

  for await (const chunk of child.stdout) {
    const chunkBuffer = toBuffer(chunk as Buffer | string);
    const text = chunkBuffer.toString();
    if (shouldCaptureOutput) {
      appendBoundedOutput(chunkBuffer);
    }

    if (outputBufferMode !== 'disabled') {
      yield text;
    }
    lastLineBuffer += text;
    // Keep only content after last newline to minimize memory usage
    const lastNewlineIndex = lastLineBuffer.lastIndexOf('\n');
    if (lastNewlineIndex !== -1) {
      // Discard everything before the last newline, keep only the last line
      lastLineBuffer = lastLineBuffer.substring(lastNewlineIndex + 1);
    }
    if (lastLineBuffer.length > MAX_LAST_LINE_BUFFER_CHARS) {
      lastLineBuffer = lastLineBuffer.slice(-MAX_LAST_LINE_BUFFER_CHARS);
    }
  }

  if (shouldCaptureOutput && outputBufferSnapshot) {
    const snapshot = boundedOutput;
    outputBufferSnapshot.value = snapshot.toString('utf8');
  }

  // Process the last line to detect and handle sentinel
  const lastLine = lastLineBuffer.trim();
  if (lastLine) {
    const parsed = parseSentinel(lastLine);
    if (parsed) {
      options?.onSentinel?.(parsed.meta, parsed.rid);
    }
  }

  await closePromise;
}
