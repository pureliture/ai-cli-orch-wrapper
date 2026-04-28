import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SyncManifest, SyncWarning, ManifestTargetRecord } from './transform-interface.js';

const MANIFEST_DIR = '.aco';
const MANIFEST_FILE = 'sync-manifest.json';

export async function readManifest(rootPath: string): Promise<SyncManifest | null> {
  try {
    const path = join(rootPath, MANIFEST_DIR, MANIFEST_FILE);
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<SyncManifest>;
    return migrateManifest(parsed);
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

  // Compare target records (ownership-aware)
  for (const [path, record] of Object.entries(updated.targets)) {
    const currentRecord = current.targets[path];
    if (!currentRecord) return true;
    if (currentRecord.hash !== record.hash) return true;
    if (currentRecord.owner !== record.owner) return true;
    if (currentRecord.kind !== record.kind) return true;
  }

  // Check for removed targets
  if (Object.keys(current.targets).length !== Object.keys(updated.targets).length) {
    return true;
  }

  return false;
}

/**
 * Migrate a legacy manifest (with only targetHashes) to the ownership-aware format.
 */
function migrateManifest(parsed: Partial<SyncManifest>): SyncManifest {
  const legacy = parsed as Record<string, unknown>;

  // If already migrated, return as-is
  if (legacy.targets && typeof legacy.targets === 'object') {
    return {
      version: (legacy.version as string) || '2',
      generatedAt: (legacy.generatedAt as string) || new Date().toISOString(),
      sourceHashes: (legacy.sourceHashes as Record<string, string>) || {},
      targetHashes: (legacy.targetHashes as Record<string, string>) || {},
      targets: (legacy.targets as Record<string, ManifestTargetRecord>) || {},
      skipped: (legacy.skipped as SyncManifest['skipped']) || [],
      warnings: (legacy.warnings as SyncWarning[]) || [],
    };
  }

  // Migrate from legacy v1 format
  const targetHashes = (legacy.targetHashes as Record<string, string>) || {};
  const targets: Record<string, ManifestTargetRecord> = {};

  for (const [path, hash] of Object.entries(targetHashes)) {
    targets[path] = {
      hash,
      owner: 'aco',
      kind: inferKindFromPath(path),
      hashFormat: 'legacy-v1',
    };
  }

  return {
    version: '2',
    generatedAt: new Date().toISOString(),
    sourceHashes: (legacy.sourceHashes as Record<string, string>) || {},
    targetHashes,
    targets,
    skipped: [],
    warnings: (legacy.warnings as SyncWarning[]) || [],
  };
}

function inferKindFromPath(path: string): ManifestTargetRecord['kind'] {
  if (path.includes('/skills/')) return 'shared-skill';
  if (path.includes('/agents/')) return 'agent';
  if (path.includes('/hooks/')) return 'provider-command';
  if (path.endsWith('AGENTS.md') || path.endsWith('GEMINI.md')) return 'config';
  return 'shared-skill';
}
