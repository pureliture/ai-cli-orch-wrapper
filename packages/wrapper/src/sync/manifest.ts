import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SyncManifest, SyncWarning } from './transform-interface.js';

const MANIFEST_DIR = '.aco';
const MANIFEST_FILE = 'sync-manifest.json';

export async function readManifest(rootPath: string): Promise<SyncManifest | null> {
  try {
    const path = join(rootPath, MANIFEST_DIR, MANIFEST_FILE);
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function writeManifest(rootPath: string, manifest: SyncManifest): Promise<void> {
  const dir = join(rootPath, MANIFEST_DIR);
  await mkdir(dir, { recursive: true });
  const path = join(dir, MANIFEST_FILE);
  await writeFile(path, JSON.stringify(manifest, null, 2));
}

export function calculateDrift(current: SyncManifest | null, updated: SyncManifest): boolean {
  if (!current) return true;

  // Compare source hashes
  for (const [path, hash] of Object.entries(updated.sourceHashes)) {
    if (current.sourceHashes[path] !== hash) return true;
  }

  // Check for removed sources
  if (Object.keys(current.sourceHashes).length !== Object.keys(updated.sourceHashes).length) {
    return true;
  }

  return false;
}
