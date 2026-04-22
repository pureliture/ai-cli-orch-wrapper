import { cp, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SyncSource, SyncOutput, SyncWarning, SyncManifest } from './transform-interface.js';

export async function syncSkills(
  sources: SyncSource[],
  repoRoot: string,
  manifest: SyncManifest | null,
  dryRun: boolean
): Promise<{ outputs: SyncOutput[]; warnings: SyncWarning[] }> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];
  const skillSources = sources.filter((s) => s.kind === 'skill');
  const targetBase = join(repoRoot, '.agents', 'skills');

  // Determine which skills to remove: previously synced but source no longer exists
  const currentSourcePaths = new Set(skillSources.map((s) => s.path));
  const staleTargets: string[] = [];

  if (manifest) {
    for (const [targetPath, oldHash] of Object.entries(manifest.targetHashes)) {
      if (!targetPath.startsWith(targetBase)) continue;
      // Find if this target corresponds to a skill that still exists
      const stillExists = skillSources.some((s) => {
        const skillName = s.path.split('/').slice(-2)[0];
        const expectedTarget = join(targetBase, skillName);
        return targetPath.startsWith(expectedTarget);
      });
      if (!stillExists) {
        staleTargets.push(targetPath);
      }
    }
  }

  // Remove stale targets
  for (const targetPath of staleTargets) {
    if (!dryRun) {
      try {
        // Only remove if directory is empty or contains only manifest-owned content
        const entries = await readdir(targetPath);
        if (entries.length === 0) {
          await rm(targetPath, { recursive: true, force: true });
        }
      } catch {
        // Already removed or not accessible
      }
    }
    outputs.push({
      targetPath,
      kind: 'directory',
      action: 'removed',
      hash: '',
    });
  }

  // Sync current skills
  for (const skillSource of skillSources) {
    const skillName = skillSource.path.split('/').slice(-2)[0];
    const sourceDir = skillSource.path.replace(/\/SKILL\.md$/, '');
    const targetDir = join(targetBase, skillName);

    const action = existsSync(targetDir) ? 'updated' : 'created';

    if (!dryRun) {
      await cp(sourceDir, targetDir, { recursive: true, force: true });
    }

    outputs.push({
      targetPath: targetDir,
      kind: 'directory',
      action,
      hash: skillSource.hash,
    });
  }

  return { outputs, warnings };
}
