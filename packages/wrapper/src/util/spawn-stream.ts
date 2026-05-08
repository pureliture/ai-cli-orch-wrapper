import { spawn } from 'node:child_process';
import type {
  InvokeOptions,
  OutputBufferMode,
} from '../providers/interface.js';
import {
  DEFAULT_OUTPUT_BUFFER_BYTES,
  DEFAULT_OUTPUT_BUFFER_MODE,
  MAX_OUTPUT_BUFFER_BYTES,
  type OutputBufferPolicy,
} from '../providers/interface.js';
import { parseSentinel, type SentinelMeta } from './sentinel.js';

export interface SpawnStreamConfig {
  /** Process name used in error messages, e.g. "gemini". */
  processName: string;
  /** Whether to pipe stdin (so it can be closed) or ignore it. */
  stdin: 'pipe' | 'ignore';
}

export interface SpawnStreamOptions extends InvokeOptions {
  /** Callback invoked when a sentinel line is detected. */
  onSentinel?: (meta: SentinelMeta, rid: string) => void;
}

const MAX_STDERR_CHARS = 4_000;

function normalizeOutputBufferPolicy(
  outputBuffer: OutputBufferPolicy | undefined
): Required<Pick<OutputBufferPolicy, 'mode' | 'maxBytes'>> {
  const mode: OutputBufferMode = outputBuffer?.mode ?? DEFAULT_OUTPUT_BUFFER_MODE;
  const maxBytes = outputBuffer?.maxBytes ?? DEFAULT_OUTPUT_BUFFER_BYTES;
  if (!VALID_OUTPUT_BUFFER_MODES.includes(mode)) {
    throw new Error(`Invalid outputBuffer.mode '${mode}'`);
  }

  if (mode !== 'bounded') {
    return { mode, maxBytes: maxBytes };
  }

  if (!Number.isFinite(maxBytes) || !Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Invalid outputBuffer.maxBytes: must be an integer >= 1 in bounded mode');
  }

  if (maxBytes > MAX_OUTPUT_BUFFER_BYTES) {
    throw new Error(
      `Invalid outputBuffer.maxBytes: exceeds max ${MAX_OUTPUT_BUFFER_BYTES} bytes`
    );
  }

  return { mode, maxBytes };
}

const VALID_OUTPUT_BUFFER_MODES: OutputBufferMode[] = ['stream-only', 'bounded', 'disabled'];

const trimToMaxBytes = (value: Buffer<ArrayBufferLike>, maxBytes: number): Buffer<ArrayBufferLike> => {
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
  const child = spawn(binary, args, {
    stdio: [config.stdin, 'pipe', 'pipe'],
  });

  if (child.pid !== undefined) {
    options?.onPid?.(child.pid);
  }

  if (config.stdin === 'pipe' && child.stdin) {
    child.stdin.end();
  }

  const outputBufferPolicy = normalizeOutputBufferPolicy(options?.outputBuffer);
  const outputBufferMode = outputBufferPolicy.mode;
  const outputBufferMaxBytes = outputBufferPolicy.maxBytes;
  const outputBufferSnapshot = options?.outputBuffer?.snapshot;
  const shouldCaptureOutput = outputBufferMode === 'bounded' && outputBufferSnapshot !== undefined;

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
    throw new Error(`${config.processName}: failed to open stdout pipe`);
  }

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

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code, signal) => {
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
    child.on('error', reject);
  });
}
