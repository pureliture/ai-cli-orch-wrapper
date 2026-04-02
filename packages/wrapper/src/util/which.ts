import { accessSync, constants } from 'node:fs';
import { join } from 'node:path';

/** Returns the full path of a binary if found in PATH, or null. */
export function which(binary: string): string | null {
  const pathDirs = (process.env['PATH'] ?? '').split(':').filter(Boolean);
  for (const dir of pathDirs) {
    const full = join(dir, binary);
    try {
      accessSync(full, constants.X_OK);
      return full;
    } catch {
      // not found or not executable in this dir
    }
  }
  return null;
}
