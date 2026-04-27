import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const AUTH_CHECK_TIMEOUT_MS = 5_000;

export async function readVersion(binary: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(binary, ['--version'], {
      timeout: AUTH_CHECK_TIMEOUT_MS,
    });
    const output = typeof stdout === 'string' ? stdout.trim() : '';
    if (!output) return undefined;
    return output.split('\n')[0].trim();
  } catch {
    return undefined;
  }
}
