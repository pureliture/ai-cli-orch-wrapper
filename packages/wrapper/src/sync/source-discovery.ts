import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { SyncSource } from './transform-interface.js';
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
    const sortedRules = rules.filter(f => f.endsWith('.md')).sort();
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
        await tryAddSource(sources, skillMdPath, 'skill');
      } catch {}
    }
  } catch {}

  // 5. .claude/agents/*.md
  const agentsDir = join(rootPath, '.claude/agents');
  try {
    const agents = await readdir(agentsDir);
    for (const agent of agents.filter(f => f.endsWith('.md'))) {
      await tryAddSource(sources, join(agentsDir, agent), 'agent');
    }
  } catch {}

  // 6. .claude/settings.json (for hooks)
  await tryAddSource(sources, join(rootPath, '.claude/settings.json'), 'settings');

  return sources;
}

async function tryAddSource(sources: SyncSource[], path: string, kind: SyncSource['kind']) {
  try {
    const content = await readFile(path, 'utf-8');
    sources.push({
      path,
      kind,
      content,
      hash: computeHash(content)
    });
  } catch {
    // File not found or unreadable - skip
  }
}
