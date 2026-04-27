import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { SyncSource, AssetKind } from './transform-interface.js';
import { computeHash } from './hash.js';

export async function discoverSources(rootPath: string): Promise<SyncSource[]> {
  const sources: SyncSource[] = [];

  // 1. CLAUDE.md at repo root
  await tryAddSource(sources, join(rootPath, 'CLAUDE.md'), 'config');

  // 2. .claude/CLAUDE.md (optional)
  await tryAddSource(sources, join(rootPath, '.claude/CLAUDE.md'), 'config');

  // 3. .claude/rules/*.md sorted lexicographically
  const rulesDir = join(rootPath, '.claude/rules');
  try {
    const rules = await readdir(rulesDir);
    const sortedRules = rules.filter((f) => f.endsWith('.md')).sort();
    for (const rule of sortedRules) {
      await tryAddSource(sources, join(rulesDir, rule), 'rule');
    }
  } catch {}

  // 4. .claude/skills/*/SKILL.md
  const skillsDir = join(rootPath, '.claude/skills');
  try {
    const skillDirs = await readdir(skillsDir);
    for (const skillDir of skillDirs) {
      const skillMdPath = join(skillsDir, skillDir, 'SKILL.md');
      try {
        await stat(skillMdPath); // Check if SKILL.md exists
        await tryAddSkillSource(sources, skillMdPath);
      } catch {}
    }
  } catch {}

  // 5. .claude/agents/*.md
  const agentsDir = join(rootPath, '.claude/agents');
  try {
    const agents = await readdir(agentsDir);
    for (const agent of agents.filter((f) => f.endsWith('.md'))) {
      await tryAddSource(sources, join(agentsDir, agent), 'agent');
    }
  } catch {}

  // 6. .claude/settings.json (for hooks)
  await tryAddSource(sources, join(rootPath, '.claude/settings.json'), 'settings');

  return sources;
}

async function tryAddSource(sources: SyncSource[], path: string, kind: SyncSource['kind']) {
  try {
    const content = await readFile(path, 'utf8');
    sources.push({
      path,
      kind,
      content,
      hash: computeHash(content),
    });
  } catch {
    // File not found or unreadable - skip
  }
}

async function tryAddSkillSource(sources: SyncSource[], path: string) {
  try {
    const content = await readFile(path, 'utf8');
    const frontmatter = parseSkillFrontmatter(content);
    sources.push({
      path,
      kind: 'skill',
      content,
      hash: computeHash(content),
      owner: frontmatter['x-aco-owned'] ? 'aco' : undefined,
      assetKind: frontmatter['x-aco-kind'] as AssetKind | undefined,
      targets: frontmatter['x-aco-targets'] as string[] | undefined,
    });
  } catch {
    // File not found or unreadable - skip
  }
}

function parseSkillFrontmatter(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!content.startsWith('---')) return result;

  const end = content.indexOf('---', 3);
  if (end === -1) return result;

  const frontmatter = content.slice(3, end).trim();
  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (key === 'x-aco-owned') {
      result['x-aco-owned'] = value === 'true' || value === 'yes';
    } else if (key === 'x-aco-kind') {
      result['x-aco-kind'] = value.replace(/['"]/g, '');
    } else if (key === 'x-aco-targets') {
      result['x-aco-targets'] = value
        .split(/,\s*/)
        .map((s) => s.trim().replace(/['"\[\]]/g, ''))
        .filter(Boolean);
    }
  }

  return result;
}
