import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SyncConfig } from './transform-interface.js';

/**
 * Load `.aco/sync.yaml` if it exists, otherwise return default config.
 * Default config denies all skills (empty include), with common
 * external/provider-specific patterns in exclude.
 */
export async function loadSyncConfig(repoRoot: string): Promise<SyncConfig> {
  const configPath = join(repoRoot, '.aco', 'sync.yaml');
  try {
    const content = await readFile(configPath, 'utf8');
    return parseSyncConfig(content);
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    if (error.code === 'ENOENT') {
      return getDefaultSyncConfig();
    }
    throw err;
  }
}

function getDefaultSyncConfig(): SyncConfig {
  return {
    skills: {
      include: [],
      exclude: ['openspec-*', 'superpowers-*', 'gh-*'],
    },
  };
}

function parseSyncConfig(content: string): SyncConfig {
  // Very small YAML subset parser for sync.yaml.
  // Only supports top-level `skills:` with `include:` and `exclude:` string lists.
  const config: SyncConfig = {};
  const lines = content.split('\n');
  let currentSection: 'include' | 'exclude' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('#') || trimmed === '') continue;

    if (trimmed === 'skills:' || trimmed.startsWith('skills:')) {
      config.skills ??= {};
      currentSection = null;
      continue;
    }

    if (trimmed === 'include:' || trimmed.startsWith('include:')) {
      currentSection = 'include';
      config.skills ??= {};
      continue;
    }

    if (trimmed === 'exclude:' || trimmed.startsWith('exclude:')) {
      currentSection = 'exclude';
      config.skills ??= {};
      continue;
    }

    if (trimmed.startsWith('- ') && currentSection) {
      const value = trimmed.slice(2).trim().replace(/['"]/g, '');
      config.skills ??= {};
      config.skills[currentSection] ??= [];
      config.skills[currentSection]!.push(value);
    }
  }

  return config;
}

/**
 * Test if a skill name matches a glob pattern.
 * Supports `*` wildcard only.
 */
export function matchesGlob(name: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  );
  return regex.test(name);
}

/**
 * Determine if a skill name is explicitly included by the config.
 */
export function isIncluded(name: string, config: SyncConfig): boolean {
  if (!config.skills?.include || config.skills.include.length === 0) {
    return false; // default deny
  }
  return config.skills.include.some((pattern) => matchesGlob(name, pattern));
}

/**
 * Determine if a skill name is explicitly excluded by the config.
 * Exclude takes precedence over include.
 */
export function isExcluded(name: string, config: SyncConfig): boolean {
  if (!config.skills?.exclude || config.skills.exclude.length === 0) {
    return false;
  }
  return config.skills.exclude.some((pattern) => matchesGlob(name, pattern));
}
