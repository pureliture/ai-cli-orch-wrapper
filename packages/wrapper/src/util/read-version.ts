import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 5_000;

export async function readVersion(
  binary: string,
  timeout = DEFAULT_TIMEOUT_MS
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(binary, ['--version'], {
      timeout,
    });
    const output = typeof stdout === 'string' ? stdout.trim() : '';
    if (!output) return undefined;
    return output.split('\n')[0].trim();
  } catch {
    return undefined;
  }
}
