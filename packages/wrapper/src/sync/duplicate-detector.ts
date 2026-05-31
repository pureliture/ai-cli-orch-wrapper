import { readdir, stat } from 'node:fs/promises';
import { join, basename, extname, dirname, relative, normalize, isAbsolute } from 'node:path';
import type { SyncWarning, SyncOutput } from './transform-interface.js';

interface ExposureEntry {
  provider: string;
  name: string;
  path: string;
  kind: 'command' | 'skill';
}

function isUnderDir(entryPath: string, dirPath: string): boolean {
  const rel = relative(dirPath, entryPath);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function canonicalExternalName(name: string): string {
  if (name.startsWith('opsx/')) {
    return `openspec-${name.slice(5)}`;
  }
  if (name.startsWith('openspec-')) {
    if (name.endsWith('-change')) {
      return name.slice(0, -7);
    }
    return name;
  }
  if (name.startsWith('superpowers-')) {
    return name;
  }
  return name;
}

/**
 * Build a provider exposure index from provider-specific commands and shared skills,
 * then detect duplicate provider-surface exposures.
 */
export async function detectDuplicates(
  repoRoot: string,
  outputs: SyncOutput[]
): Promise<SyncWarning[]> {
  const warnings: SyncWarning[] = [];
  const index: ExposureEntry[] = [];

  // 1. Index shared skills (.agents/skills/*/)
  const agentsSkillsDir = join(repoRoot, '.agents', 'skills');
  try {
    const entries = await readdir(agentsSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.includes('..') || entry.name.includes('/') || entry.name.includes('\\')) {
        continue;
      }
      if (entry.isDirectory()) {
        const name = entry.name;
        index.push({
          provider: 'agents',
          name,
          path: join(agentsSkillsDir, name, 'SKILL.md'),
          kind: 'skill',
        });
      }
    }
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code !== 'ENOENT') {
      warnings.push({
        source: agentsSkillsDir,
        message: `Failed to scan shared skills: ${e.message}`,
        severity: 'warning',
      });
    }
  }

  // 3. Index Codex skills (.codex/skills/*/)
  const codexSkillsDir = join(repoRoot, '.codex', 'skills');
  try {
    const entries = await readdir(codexSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.includes('..') || entry.name.includes('/') || entry.name.includes('\\')) {
        continue;
      }
      if (entry.isDirectory()) {
        const name = entry.name;
        index.push({
          provider: 'codex',
          name,
          path: join(codexSkillsDir, name, 'SKILL.md'),
          kind: 'skill',
        });
      }
    }
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code !== 'ENOENT') {
      warnings.push({
        source: codexSkillsDir,
        message: `Failed to scan Codex skills: ${e.message}`,
        severity: 'warning',
      });
    }
  }

  // 4. Index Claude commands (.claude/commands/*.md)
  const claudeCommandsDir = join(repoRoot, '.claude', 'commands');
  try {
    const entries = await readdir(claudeCommandsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.includes('..') || entry.name.includes('/') || entry.name.includes('\\')) {
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const name = basename(entry.name, '.md');
        index.push({
          provider: 'claude',
          name,
          path: join(claudeCommandsDir, entry.name),
          kind: 'command',
        });
      }
    }
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    if (e.code !== 'ENOENT') {
      warnings.push({
        source: claudeCommandsDir,
        message: `Failed to scan Claude commands: ${e.message}`,
        severity: 'warning',
      });
    }
  }

  // 5. Index planned outputs
  for (const output of outputs) {
    if (output.action === 'removed') continue;
    if (output.assetKind === 'command-alias-skill' || output.assetKind === 'shared-skill') {
      const name = basename(output.targetPath);
      index.push({
        provider: 'agents',
        name,
        path: join(output.targetPath, 'SKILL.md'),
        kind: 'skill',
      });
    }
  }

  // 5.5 Deduplicate entries with identical provider:name:path to avoid false positives
  const seen = new Set<string>();
  const dedupedIndex: ExposureEntry[] = [];
  for (const entry of index) {
    const key = `${entry.provider}:${entry.name}:${entry.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedIndex.push(entry);
  }

  // 6. Detect duplicates: same provider + same name from multiple surfaces
  const byProviderName = new Map<string, ExposureEntry[]>();
  const warnedCanonicals = new Set<string>();
  for (const entry of dedupedIndex) {
    const key = `${entry.provider}:${entry.name}`;
    const list = byProviderName.get(key) ?? [];
    list.push(entry);
    byProviderName.set(key, list);
  }

  for (const [key, entries] of byProviderName) {
    if (entries.length < 2) continue;

    const [provider, name] = key.split(':', 2);
    const paths = entries.map((e) => relative(repoRoot, e.path) || e.path).join(', ');

    // Determine if this is an external duplicate
    const isOpenSpec = name.startsWith('openspec-') || name.startsWith('opsx/');
    const isSuperpowers = name.startsWith('superpowers-');
    const isExternal = isOpenSpec || isSuperpowers;
    const isCommandAlias = name.startsWith('gh-');

    let message: string;
    let severity: 'warning' | 'error' = 'warning';
    let cleanupTargets: string[] | undefined;

    if (isExternal) {
      warnedCanonicals.add(`${provider}:${canonicalExternalName(name)}`);
      const agentsSkillsDir = join(repoRoot, '.agents', 'skills');
      const codexSkillsDir = join(repoRoot, '.codex', 'skills');
      cleanupTargets = entries
        .filter((e) => isUnderDir(e.path, agentsSkillsDir) || isUnderDir(e.path, codexSkillsDir))
        .map((e) => (e.kind === 'skill' ? dirname(e.path) : e.path));
      const cleanupText = cleanupTargets.join(', ') || 'none';
      message =
        `External asset duplicate: provider ${provider} exposes '${name}' from multiple surfaces (${paths}). ` +
        `Cleanup target: ${cleanupText}. ` +
        `Recommendation: keep upstream-managed source; remove ACO-generated copies.`;
    } else if (isCommandAlias) {
      cleanupTargets = entries
        .filter((e) => e.kind === 'skill')
        .map((e) => (e.kind === 'skill' ? dirname(e.path) : e.path));
      const cleanupText = cleanupTargets.join(', ') || 'none';
      message =
        `Command alias duplicate: provider ${provider} exposes '${name}' from both command and skill surfaces (${paths}). ` +
        `Cleanup target: ${cleanupText}. ` +
        `Recommendation: keep provider-native command; remove shared command-alias skill copy.`;
    } else {
      message =
        `Duplicate provider exposure: provider ${provider} exposes '${name}' from multiple surfaces (${paths}). ` +
        `Recommendation: consolidate into a single surface.`;
    }

    warnings.push({
      source: relative(repoRoot, entries[0].path) || entries[0].path,
      message,
      severity,
      cleanupTargets,
    });
  }

  // 7. Cross-name canonical duplicate detection for OpenSpec
  const openSpecEntries = dedupedIndex.filter(
    (e) => e.name.startsWith('openspec-') || e.name.startsWith('opsx/')
  );
  const byProviderCanonical = new Map<string, ExposureEntry[]>();
  for (const entry of openSpecEntries) {
    const key = `${entry.provider}:${canonicalExternalName(entry.name)}`;
    const list = byProviderCanonical.get(key) ?? [];
    list.push(entry);
    byProviderCanonical.set(key, list);
  }

  for (const [key, entries] of byProviderCanonical) {
    if (entries.length < 2) continue;
    if (warnedCanonicals.has(key)) continue;
    warnedCanonicals.add(key);

    const [provider, canonical] = key.split(':', 2);
    const names = entries.map((e) => `'${e.name}'`).join(', ');
    const paths = entries.map((e) => relative(repoRoot, e.path) || e.path).join(', ');

    const agentsSkillsDir = join(repoRoot, '.agents', 'skills');
    const codexSkillsDir = join(repoRoot, '.codex', 'skills');
    const cleanupTargets = entries
      .filter((e) => isUnderDir(e.path, agentsSkillsDir) || isUnderDir(e.path, codexSkillsDir))
      .map((e) => (e.kind === 'skill' ? dirname(e.path) : e.path));
    const cleanupText = cleanupTargets.join(', ') || 'none';
    const message =
      `External asset duplicate: provider ${provider} exposes ${names} from multiple surfaces (${paths}). ` +
      `Cleanup target: ${cleanupText}. ` +
      `Recommendation: keep upstream-managed source; remove ACO-generated copies.`;

    warnings.push({
      source: relative(repoRoot, entries[0].path) || entries[0].path,
      message,
      severity: 'warning',
      cleanupTargets,
    });
  }

  return warnings;
}
