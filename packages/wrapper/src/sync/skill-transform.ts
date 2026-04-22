import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SyncSource, SyncOutput, SyncWarning, SyncManifest } from './transform-interface.js';

export async function syncSkills(
  sources: SyncSource[],
  repoRoot: string,
  manifest: SyncManifest | null
): Promise<{ outputs: SyncOutput[]; warnings: SyncWarning[] }> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];
  const skillSources = sources.filter((s) => s.kind === 'skill');
  const targetBase = join(repoRoot, '.agents', 'skills');

  // Determine which skills to remove: previously synced but source no longer exists
  const staleTargets: string[] = [];

  if (manifest) {
    for (const [targetPath] of Object.entries(manifest.targetHashes)) {
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

  // Remove stale targets (deferred to sync-engine)
  for (const targetPath of staleTargets) {
    outputs.push({
      targetPath,
      kind: 'directory',
      action: 'removed',
      hash: '',
    });
  }

  // Sync current skills (deferred to sync-engine)
  for (const skillSource of skillSources) {
    const skillName = skillSource.path.split('/').slice(-2)[0];
    const sourceDir = skillSource.path.replace(/\/SKILL\.md$/, '');
    const targetDir = join(targetBase, skillName);

    const action = existsSync(targetDir) ? 'updated' : 'created';

    outputs.push({
      targetPath: targetDir,
      kind: 'directory',
      action,
      hash: skillSource.hash,
      sourcePath: sourceDir,
    });
  }

  return { outputs, warnings };
}
