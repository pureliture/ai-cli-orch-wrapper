import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 5_000;

function firstNonEmptyLine(output: string | Buffer): string | undefined {
  const text = typeof output === 'string' ? output : output.toString('utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

export async function readVersion(
  binary: string,
  timeout = DEFAULT_TIMEOUT_MS
): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(binary, ['--version'], {
      timeout,
    });
    return firstNonEmptyLine(stdout) ?? firstNonEmptyLine(stderr) ?? '';
  } catch {
    return undefined;
  }
}
