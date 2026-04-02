import { spawn } from 'node:child_process';
import type { InvokeOptions } from '../providers/interface.js';

export interface SpawnStreamConfig {
  /** Process name used in error messages, e.g. "gemini" or "copilot". */
  processName: string;
  /** Whether to pipe stdin (so it can be closed) or ignore it. */
  stdin: 'pipe' | 'ignore';
}

/**
 * Spawns a child process and yields its stdout as string chunks.
 * Drains stderr to prevent buffer deadlock.
 * Calls options.onPid once the process has a PID.
 */
export async function* spawnStream(
  binary: string,
  args: string[],
  config: SpawnStreamConfig,
  options?: InvokeOptions,
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

  // Drain stderr to prevent the OS pipe buffer from filling and blocking stdout
  child.stderr?.resume();

  if (!child.stdout) {
    throw new Error(`${config.processName}: failed to open stdout pipe`);
  }

  for await (const chunk of child.stdout) {
    yield (chunk as Buffer).toString();
  }

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${config.processName} exited with code ${code}`));
      } else {
        resolve();
      }
    });
    child.on('error', reject);
  });
}
