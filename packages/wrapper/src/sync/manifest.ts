import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import type { SyncManifest, SyncWarning, ManifestTargetRecord } from './transform-interface.js';

const MANIFEST_DIR = '.aco';
const MANIFEST_FILE = 'sync-manifest.json';

export async function readManifest(rootPath: string): Promise<SyncManifest | null> {
  try {
    const path = join(rootPath, MANIFEST_DIR, MANIFEST_FILE);
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<SyncManifest>;
    return migrateManifest(parsed, rootPath);
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
 * Migrate a manifest through version history:
 *   v1 (targetHashes only) → v2 (ownership-aware targets)
 *   v2 (absolute sourceHashes) → v3 (repo-relative sourceHashes)
 *   v3 (absolute targetHashes/targets keys) → v4 (repo-relative targetHashes/targets keys)
 *   v4 (includes GEMINI.md / .gemini/agents/* targets) → v5 (Gemini targets removed)
 */
export function migrateManifest(parsed: Partial<SyncManifest>, rootPath: string): SyncManifest {
  const legacy = parsed as Record<string, unknown>;

  // v1 → v2: add ownership-aware targets
  if (!legacy.targets || typeof legacy.targets !== 'object') {
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
    legacy.targets = targets;
    legacy.version = '2';
    legacy.generatedAt = legacy.generatedAt ?? new Date().toISOString();
    legacy.sourceHashes = legacy.sourceHashes ?? {};
    legacy.targetHashes = targetHashes;
    legacy.skipped = [];
    legacy.warnings = legacy.warnings ?? [];
  }

  // Numeric version gate: each step runs when the manifest predates that step.
  const versionNum = Number.parseInt((legacy.version as string) || '2', 10) || 0;
  const warnings: SyncWarning[] = (legacy.warnings as SyncWarning[]) || [];

  // → v3: convert absolute sourceHashes keys to repo-relative
  if (versionNum < 3) {
    const sourceHashes = (legacy.sourceHashes as Record<string, string>) || {};
    const migratedHashes: Record<string, string> = {};
    for (const [key, hash] of Object.entries(sourceHashes)) {
      if (isAbsolute(key)) {
        const rel = relative(rootPath, key);
        if (rel.startsWith('..')) {
          warnings.push({
            severity: 'warning',
            source: 'manifest-migration',
            message: `Skipping absolute sourceHash key outside repo root: "${key}"`,
          });
          continue;
        }
        migratedHashes[rel] = hash;
      } else {
        migratedHashes[key] = hash;
      }
    }
    legacy.sourceHashes = migratedHashes;
    legacy.version = '3';
    legacy.warnings = warnings;
  }

  // → v4: convert absolute targetHashes/targets keys to repo-relative.
  // aco가 생성하는 target은 항상 repoRoot 내부이므로 relative()의 `../` 분기는
  // 실무상 도달 불가하다. 방어적으로 원본 절대 키를 유지하지만 sourceHashes처럼
  // drop+warning하지는 않는다.
  if (versionNum < 4) {
    const targetHashes = (legacy.targetHashes as Record<string, string>) || {};
    const migratedTargetHashes: Record<string, string> = {};
    for (const [key, hash] of Object.entries(targetHashes)) {
      if (isAbsolute(key)) {
        const rel = relative(rootPath, key);
        migratedTargetHashes[rel.startsWith('..') ? key : rel] = hash;
      } else {
        migratedTargetHashes[key] = hash;
      }
    }
    legacy.targetHashes = migratedTargetHashes;

    const targets = (legacy.targets as Record<string, ManifestTargetRecord>) || {};
    const migratedTargets: Record<string, ManifestTargetRecord> = {};
    for (const [key, record] of Object.entries(targets)) {
      if (isAbsolute(key)) {
        const rel = relative(rootPath, key);
        migratedTargets[rel.startsWith('..') ? key : rel] = record;
      } else {
        migratedTargets[key] = record;
      }
    }
    legacy.targets = migratedTargets;
    legacy.version = '4';
  }

  // → v5: drop aco-owned GEMINI.md and .gemini/agents/* targets that are no longer
  // emitted by the sync engine. External/unknown-owned entries are preserved.
  const legacyVersionNum = Number.parseInt((legacy.version as string) || '4', 10) || 0;
  if (legacyVersionNum < 5) {
    const targetHashes = (legacy.targetHashes as Record<string, string>) || {};
    const targets = (legacy.targets as Record<string, ManifestTargetRecord>) || {};

    const isGeminiTarget = (key: string): boolean =>
      key === 'GEMINI.md' || key.startsWith('.gemini/agents/');

    for (const key of Object.keys(targetHashes)) {
      if (!isGeminiTarget(key)) continue;
      const record = targets[key];
      // Only remove aco-owned entries; preserve external/unknown ownership
      if (!record || record.owner === 'aco') {
        delete targetHashes[key];
      }
    }
    for (const key of Object.keys(targets)) {
      if (!isGeminiTarget(key)) continue;
      if (targets[key].owner === 'aco') {
        delete targets[key];
      }
    }

    legacy.targetHashes = targetHashes;
    legacy.targets = targets;
    legacy.version = '5';
  }

  return {
    version: '5',
    generatedAt: (legacy.generatedAt as string) || new Date().toISOString(),
    sourceHashes: (legacy.sourceHashes as Record<string, string>) || {},
    targetHashes: (legacy.targetHashes as Record<string, string>) || {},
    targets: (legacy.targets as Record<string, ManifestTargetRecord>) || {},
    skipped: (legacy.skipped as SyncManifest['skipped']) || [],
    warnings: (legacy.warnings as SyncWarning[]) || [],
  };
}

function inferKindFromPath(path: string): ManifestTargetRecord['kind'] {
  if (path.includes('/skills/')) return 'shared-skill';
  if (path.includes('/agents/')) return 'agent';
  if (path.includes('/hooks/')) return 'provider-command';
  if (path.endsWith('AGENTS.md')) return 'config';
  return 'shared-skill';
}
