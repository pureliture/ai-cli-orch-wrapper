import { spawn } from 'node:child_process';
import type { InvokeOptions } from '../providers/interface.js';

export interface SpawnStreamConfig {
  /** Process name used in error messages, e.g. "gemini" or "copilot". */
  processName: string;
  /** Whether to pipe stdin (so it can be closed) or ignore it. */
  stdin: 'pipe' | 'ignore';
}

const MAX_STDERR_CHARS = 4_000;

/**
 * Spawns a child process and yields its stdout as string chunks.
 * Captures stderr so provider failures remain diagnosable.
 * Calls options.onPid once the process has a PID.
 */
export async function* spawnStream(
  binary: string,
  args: string[],
  config: SpawnStreamConfig,
  options?: InvokeOptions
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

  for await (const chunk of child.stdout) {
    yield (chunk as Buffer).toString();
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
