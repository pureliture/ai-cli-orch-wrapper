/**
 * Lock File Management
 *
 * Manages wrapper.lock for reproducible installations.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type {
  LockFile,
  LockedItem,
  ResolvedSource,
  SearchResult,
} from './types.js';

const LOCK_FILE_NAME = 'wrapper.lock';
const LOCK_VERSION = '1.0.0';

/**
 * Read existing lock file
 */
export function readLockFile(path = LOCK_FILE_NAME): LockFile | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as LockFile;
  } catch {
    return null;
  }
}

/**
 * Write lock file
 */
export function writeLockFile(lockFile: LockFile, path = LOCK_FILE_NAME): void {
  const content = JSON.stringify(lockFile, null, 2);
  writeFileSync(path, content);
}

/**
 * Create a new lock file
 */
export function createLockFile(hubSource: string): LockFile {
  return {
    lockVersion: LOCK_VERSION,
    generatedAt: new Date().toISOString(),
    hubSource,
    items: [],
  };
}

/**
 * Add an item to the lock file
 */
export function addLockedItem(
  lockFile: LockFile,
  item: SearchResult,
  commitSha: string
): LockedItem {
  const lockedItem: LockedItem = {
    canonicalId: item.canonicalId,
    registryType: item.registryType,
    name: item.name,
    version: item.version,
    sourceRepo: item.sourceRepo,
    sourceRef: commitSha,
    installedAt: new Date().toISOString(),
  };

  // Remove existing entry for the same name (upgrade case)
  lockFile.items = lockFile.items.filter(
    existing => !(existing.registryType === item.registryType && existing.name === item.name)
  );

  lockFile.items.push(lockedItem);
  return lockedItem;
}

/**
 * Remove an item from the lock file
 */
export function removeLockedItem(lockFile: LockFile, canonicalId: string): boolean {
  const initialLength = lockFile.items.length;
  lockFile.items = lockFile.items.filter(item => item.canonicalId !== canonicalId);
  return lockFile.items.length < initialLength;
}

/**
 * Find a locked item
 */
export function findLockedItem(lockFile: LockFile, canonicalId: string): LockedItem | null {
  return lockFile.items.find(item => item.canonicalId === canonicalId) ?? null;
}

/**
 * Generate a lock file from resolved sources
 */
export function generateLockFile(
  hubSource: string,
  resolvedSources: ResolvedSource[],
  installedIds: string[]
): LockFile {
  const lockFile = createLockFile(hubSource);

  for (const resolved of resolvedSources) {
    for (const item of resolved.manifest.items) {
      if (installedIds.includes(item.canonicalId)) {
        const lockedItem: LockedItem = {
          canonicalId: item.canonicalId,
          registryType: resolved.manifest.registryType,
          name: item.name,
          version: item.version,
          sourceRepo: resolved.source.repoUrl,
          sourceRef: resolved.commitSha,
          installedAt: new Date().toISOString(),
        };
        lockFile.items.push(lockedItem);
      }
    }
  }

  return lockFile;
}

/**
 * Check if lock file is stale (sources have newer commits)
 */
export function isLockFileStale(
  lockFile: LockFile,
  resolvedSources: ResolvedSource[]
): boolean {
  for (const locked of lockFile.items) {
    const source = resolvedSources.find(r => r.source.repoUrl === locked.sourceRepo);
    if (source && source.commitSha !== locked.sourceRef) {
      return true;
    }
  }
  return false;
}

/**
 * Format lock file as human-readable string
 */
export function formatLockFile(lockFile: LockFile): string {
  const lines: string[] = [
    `# wrapper.lock`,
    `# Generated: ${lockFile.generatedAt}`,
    `# Hub: ${lockFile.hubSource}`,
    ``,
    `Lock Version: ${lockFile.lockVersion}`,
    ``,
    `Installed Items (${lockFile.items.length}):`,
    ``,
  ];

  for (const item of lockFile.items) {
    lines.push(`  ${item.canonicalId}`);
    lines.push(`    source: ${item.sourceRepo}`);
    lines.push(`    ref: ${item.sourceRef}`);
    lines.push(`    installed: ${item.installedAt}`);
    lines.push(``);
  }

  return lines.join('\n');
}
