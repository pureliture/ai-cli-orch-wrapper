import { existsSync } from 'node:fs';
import { join, basename, dirname, normalize, relative, isAbsolute } from 'node:path';
import type {
  SyncSource,
  SyncOutput,
  SyncWarning,
  SyncManifest,
  AssetOwner,
  AssetKind,
  SyncConfig,
} from './transform-interface.js';
import { classifySkill, isSyncEligible } from './skill-classifier.js';
import { computeHash } from './hash.js';
import { readFile, readdir, lstat } from 'node:fs/promises';

function isPathWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export async function syncSkills(
  sources: SyncSource[],
  repoRoot: string,
  manifest: SyncManifest | null,
  config: SyncConfig
): Promise<{
  outputs: SyncOutput[];
  warnings: SyncWarning[];
  skipped: { path: string; owner: AssetOwner; kind: AssetKind; reason: string }[];
}> {
  const outputs: SyncOutput[] = [];
  const warnings: SyncWarning[] = [];
  const skipped: { path: string; owner: AssetOwner; kind: AssetKind; reason: string }[] = [];
  const skillSources = sources.filter((s) => s.kind === 'skill');
  const targetBase = join(repoRoot, '.agents', 'skills');
  const skillsDir = join(repoRoot, '.claude', 'skills');

  // Warn about directories under .claude/skills/ that are not skills (no SKILL.md)
  try {
    const skillsEntries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of skillsEntries) {
      if (!entry.isDirectory()) continue;
      const skPath = join(skillsDir, entry.name, 'SKILL.md');
      const hasSkillFile = existsSync(skPath);
      if (!hasSkillFile) {
        const fullPath = join(skillsDir, entry.name);
        warnings.push({
          source: relative(repoRoot, fullPath) || fullPath,
          message: `Directory ${relative(repoRoot, fullPath) || fullPath} does not contain SKILL.md; skipping as non-skill directory.`,
          severity: 'warning',
        });
      }
    }
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code === 'ENOENT') {
      // .claude/skills/ does not exist
    } else if (e.code === 'EACCES' || e.code === 'EPERM') {
      warnings.push({
        source: relative(repoRoot, skillsDir) || skillsDir,
        message: `Permission denied reading skills directory: ${e.message}`,
        severity: 'warning',
      });
    }
  }

  // Classify all skills first
  const classifiedSkills = skillSources.map((source) => {
    const skillName = basename(dirname(source.path));
    const classification = classifySkill(source, config);
    return { source, skillName, ...classification };
  });

  // Determine which skills to remove: previously synced but source no longer exists or is no longer eligible
  const staleTargets: string[] = [];

  if (manifest) {
    for (const [targetPath, record] of Object.entries(manifest.targets ?? {})) {
      if (!targetPath.startsWith(targetBase)) continue;
      // Find if this target corresponds to a skill that still exists and is still eligible
      const skillName = basename(targetPath);
      const stillExistsAndEligible = classifiedSkills.some(
        (c) => c.skillName === skillName && c.owner === 'aco'
      );
      if (!stillExistsAndEligible) {
        // Only auto-remove if manifest records it as ACO-owned and hash matches
        if (record.owner === 'aco') {
          const match = await hashMatches(targetPath, record.hash);
          if (match) {
            const stat = await lstat(targetPath);
            if (stat.isSymbolicLink()) {
              warnings.push({ source: relative(repoRoot, targetPath) || targetPath, message: `Skipping symlink in stale target removal: ${relative(repoRoot, targetPath) || targetPath}`, severity: 'warning' });
              continue;
            }
            staleTargets.push(targetPath);
          } else {
            warnings.push({
              source: relative(repoRoot, targetPath) || targetPath,
              message: `Stale target ${relative(repoRoot, targetPath) || targetPath} hash does not match manifest; skipping auto-removal. Run with --force-clean to remove.`,
              severity: 'warning',
            });
          }
        }
      }
    }

    // Also check legacy targetHashes
    for (const [targetPath] of Object.entries(manifest.targetHashes)) {
      if (!targetPath.startsWith(targetBase)) continue;
      if (manifest.targets?.[targetPath]) continue; // already handled above
      const skillName = basename(targetPath);
      const stillExistsAndEligible = classifiedSkills.some(
        (c) => c.skillName === skillName && c.owner === 'aco'
      );
      if (!stillExistsAndEligible) {
        // Legacy: assume it was ACO-owned; check hash
        const legacyHash = manifest.targetHashes[targetPath];
        const match = await hashMatches(targetPath, legacyHash);
        if (match) {
          const stat = await lstat(targetPath);
          if (stat.isSymbolicLink()) {
            warnings.push({ source: targetPath, message: `Skipping symlink in stale target removal: ${targetPath}`, severity: 'warning' });
            continue;
          }
          staleTargets.push(targetPath);
        } else {
          warnings.push({
            source: relative(repoRoot, targetPath) || targetPath,
            message: `Stale legacy target ${relative(repoRoot, targetPath) || targetPath} hash does not match; skipping auto-removal.`,
            severity: 'warning',
          });
        }
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
      owner: 'aco',
      assetKind: 'shared-skill',
    });
  }

  // Sync current skills (deferred to sync-engine)
  for (const classified of classifiedSkills) {
    const { source, skillName, owner, kind } = classified;
    const sourceDir = dirname(source.path);
    const targetDir = join(targetBase, skillName);

    // Validate sourcePath is within .claude/skills/
    const normalizedSkillsDir = normalize(join(repoRoot, '.claude', 'skills'));
    if (!isPathWithin(sourceDir, normalizedSkillsDir) && normalize(sourceDir) !== normalizedSkillsDir) {
      warnings.push({ source: sourceDir, message: `Refusing to copy from outside .claude/skills/: ${sourceDir}`, severity: 'error' });
      skipped.push({ path: source.path, owner, kind, reason: 'path traversal detected' });
      continue;
    }
    // Validate targetPath is within .agents/skills/
    const normalizedTargetBase = normalize(join(repoRoot, '.agents', 'skills'));
    if (!isPathWithin(targetDir, normalizedTargetBase) && normalize(targetDir) !== normalizedTargetBase) {
      warnings.push({ source: targetDir, message: `Refusing to write outside .agents/skills/: ${targetDir}`, severity: 'error' });
      skipped.push({ path: source.path, owner, kind, reason: 'path traversal detected' });
      continue;
    }

    if (!isSyncEligible(source, config)) {
      const reason =
        owner === 'external'
          ? `External skill ${skillName} is not ACO-owned; skipped.`
          : owner === 'provider-specific'
            ? `Provider-specific command-alias skill ${skillName} is not a shared policy skill; skipped.`
            : `Skill ${skillName} is not explicitly allowed by .aco/sync.yaml or frontmatter; skipped.`;
      skipped.push({
        path: source.path,
        owner,
        kind,
        reason,
      });
      continue;
    }

    const action = existsSync(targetDir) ? 'updated' : 'created';

    const dirHash = await computeDirHash(sourceDir);

    outputs.push({
      targetPath: targetDir,
      kind: 'directory',
      action,
      hash: dirHash,
      sourcePath: sourceDir,
      owner: 'aco',
      assetKind: kind,
    });
  }

  return { outputs, warnings, skipped };
}

async function computeDirHash(dirPath: string): Promise<string> {
  const entries = await readdir(dirPath, { recursive: true, withFileTypes: true });
  const fileHashes: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (typeof entry.isSymbolicLink === 'function' && entry.isSymbolicLink()) continue;
    const fullPath = join(entry.parentPath ?? (entry as { path?: string }).path ?? dirPath, entry.name);
    try {
      const content = await readFile(fullPath, 'utf8');
      fileHashes.push(computeHash(content));
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === 'ENOENT') continue; // race condition: file removed during read
      throw err; // EACCES, EPERM etc. should surface
    }
  }
  fileHashes.sort();
  return computeHash(fileHashes.join('\n'));
}

async function hashMatches(targetPath: string, expectedHash: string): Promise<boolean> {
  try {
    return (await computeDirHash(targetPath)) === expectedHash;
  } catch {
    return false;
  }
}
