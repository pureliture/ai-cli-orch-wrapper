import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

/** Returns the full path of a binary if found in PATH, or null. */
export function which(binary: string): string | null {
  const pathDirs = (process.env['PATH'] ?? '').split(delimiter).filter(Boolean);
  const candidates = getBinaryCandidates(binary);
  for (const dir of pathDirs) {
    for (const candidate of candidates) {
      const full = join(dir, candidate);
      try {
        accessSync(full, constants.X_OK);
        return full;
      } catch {
        // not found or not executable in this dir
      }
    }
  }
  return null;
}

function getBinaryCandidates(binary: string): string[] {
  if (process.platform !== 'win32') {
    return [binary];
  }

  const extList = (process.env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((ext) => ext.trim())
    .filter(Boolean);
  const hasKnownExtension = extList.some((ext) => binary.toLowerCase().endsWith(ext.toLowerCase()));

  if (hasKnownExtension) {
    return [binary];
  }

  return [binary, ...extList.map((ext) => `${binary}${ext}`)];
}
