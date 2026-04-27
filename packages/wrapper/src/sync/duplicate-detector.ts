import { readdir, stat } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import type { SyncWarning, SyncOutput, SyncConfig } from './transform-interface.js';

interface ExposureEntry {
  provider: string;
  name: string;
  path: string;
  kind: 'command' | 'skill';
}

/**
 * Build a provider exposure index from provider-specific commands and shared skills,
 * then detect duplicate provider-surface exposures.
 */
export async function detectDuplicates(
  repoRoot: string,
  outputs: SyncOutput[],
  _config: SyncConfig
): Promise<SyncWarning[]> {
  const warnings: SyncWarning[] = [];
  const index: ExposureEntry[] = [];

  // 1. Index Gemini commands (.gemini/commands/*.toml)
  const geminiCommandsDir = join(repoRoot, '.gemini', 'commands');
  try {
    const entries = await readdir(geminiCommandsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Subdirectories like opsx/
        const subDir = join(geminiCommandsDir, entry.name);
        const subEntries = await readdir(subDir, { withFileTypes: true });
        for (const sub of subEntries) {
          if (sub.isFile() && sub.name.endsWith('.toml')) {
            const name = basename(sub.name, '.toml');
            index.push({
              provider: 'gemini',
              name: `${entry.name}/${name}`,
              path: join(subDir, sub.name),
              kind: 'command',
            });
          }
        }
      } else if (entry.isFile() && entry.name.endsWith('.toml')) {
        const name = basename(entry.name, '.toml');
        index.push({
          provider: 'gemini',
          name,
          path: join(geminiCommandsDir, entry.name),
          kind: 'command',
        });
      }
    }
  } catch {
    // Directory may not exist
  }

  // 2. Index shared skills (.agents/skills/*/)
  const agentsSkillsDir = join(repoRoot, '.agents', 'skills');
  try {
    const entries = await readdir(agentsSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name;
        index.push({
          provider: 'gemini',
          name,
          path: join(agentsSkillsDir, name, 'SKILL.md'),
          kind: 'skill',
        });
      }
    }
  } catch {
    // Directory may not exist
  }

  // 3. Index Codex skills (.codex/skills/*/)
  const codexSkillsDir = join(repoRoot, '.codex', 'skills');
  try {
    const entries = await readdir(codexSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
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
  } catch {
    // Directory may not exist
  }

  // 4. Index Claude commands (.claude/commands/*.md)
  const claudeCommandsDir = join(repoRoot, '.claude', 'commands');
  try {
    const entries = await readdir(claudeCommandsDir, { withFileTypes: true });
    for (const entry of entries) {
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
  } catch {
    // Directory may not exist
  }

  // 5. Index planned outputs
  for (const output of outputs) {
    if (output.action === 'removed') continue;
    if (output.assetKind === 'command-alias-skill') {
      const name = basename(output.targetPath);
      index.push({
        provider: 'gemini',
        name,
        path: output.targetPath,
        kind: 'skill',
      });
    }
  }

  // 6. Detect duplicates: same provider + same name from multiple surfaces
  const byProviderName = new Map<string, ExposureEntry[]>();
  for (const entry of index) {
    const key = `${entry.provider}:${entry.name}`;
    const list = byProviderName.get(key) ?? [];
    list.push(entry);
    byProviderName.set(key, list);
  }

  for (const [key, entries] of byProviderName) {
    if (entries.length < 2) continue;

    const [provider, name] = key.split(':', 2);
    const paths = entries.map((e) => e.path).join(', ');

    // Determine if this is an external duplicate
    const isOpenSpec = name.startsWith('openspec-') || name.startsWith('opsx/');
    const isSuperpowers = name.startsWith('superpowers-');
    const isExternal = isOpenSpec || isSuperpowers;
    const isCommandAlias = name.startsWith('gh-');

    let message: string;
    let severity: 'warning' | 'error' = 'warning';

    if (isExternal) {
      message = `External asset duplicate: provider ${provider} exposes '${name}' from multiple surfaces (${paths}). ` +
        `Cleanup target: ${entries.filter((e) => e.path.includes('.agents/skills/')).map((e) => e.path).join(', ') || 'none'}. ` +
        `Recommendation: keep upstream-managed source; remove ACO-generated copies.`;
    } else if (isCommandAlias) {
      message = `Command alias duplicate: provider ${provider} exposes '${name}' from both command and skill surfaces (${paths}). ` +
        `Recommendation: keep provider-native command; remove shared command-alias skill copy.`;
    } else {
      message = `Duplicate provider exposure: provider ${provider} exposes '${name}' from multiple surfaces (${paths}). ` +
        `Recommendation: consolidate into a single surface.`;
    }

    warnings.push({
      source: entries[0].path,
      message,
      severity,
    });
  }

  return warnings;
}
