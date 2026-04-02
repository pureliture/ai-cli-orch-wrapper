import { execSync } from 'node:child_process';

/** Returns the full path of a binary if found in PATH, or null. */
export function which(binary: string): string | null {
  try {
    const result = execSync(`command -v ${binary}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return result.trim() || null;
  } catch {
    return null;
  }
}
