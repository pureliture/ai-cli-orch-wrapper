import { spawn } from 'node:child_process';
import type { InvokeOptions } from '../providers/interface.js';
import { parseSentinel, stripRid, type SentinelMeta } from './sentinel.js';

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
  let sentinelDetected = false;

  for await (const chunk of child.stdout) {
    const text = (chunk as Buffer).toString();
    lastLineBuffer += text;
    // Keep only content after last newline to minimize memory usage
    const lastNewlineIndex = lastLineBuffer.lastIndexOf('\n');
    if (lastNewlineIndex !== -1) {
      // Discard everything before the last newline, keep only the last line
      lastLineBuffer = lastLineBuffer.substring(lastNewlineIndex + 1);
    }
    yield text;
  }

  // Process the last line to detect and handle sentinel
  const lastLine = lastLineBuffer.trim();
  if (lastLine) {
    const parsed = parseSentinel(lastLine);
    if (parsed) {
      sentinelDetected = true;
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
