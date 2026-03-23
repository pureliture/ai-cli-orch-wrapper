import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { LockFile, LockedItem } from './types.js';

const LOCK_FILE_NAME = 'wrapper.lock';
const LOCK_VERSION = '1.0.0';

export function readLockFile(path = LOCK_FILE_NAME): LockFile {
  if (!existsSync(path)) {
    return {
      lockVersion: LOCK_VERSION,
      items: [],
    };
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as LockFile;
  } catch {
    return {
      lockVersion: LOCK_VERSION,
      items: [],
    };
  }
}

export function writeLockFile(lockFile: LockFile, path = LOCK_FILE_NAME): void {
  const content = JSON.stringify(lockFile, null, 2);
  writeFileSync(path, content);
}

export function addLockedItem(lockFile: LockFile, item: LockedItem): void {
  // Remove existing entry for the same URL if it exists
  lockFile.items = lockFile.items.filter(existing => existing.url !== item.url);
  lockFile.items.push(item);
}
