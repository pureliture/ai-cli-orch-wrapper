import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
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
  const raw = loadYaml(content) as Record<string, unknown> | undefined | null;
  const config: SyncConfig = {};

  if (!raw || typeof raw !== 'object') {
    return getDefaultSyncConfig();
  }

  if (raw.skills && typeof raw.skills === 'object') {
    const skills = raw.skills as Record<string, unknown>;
    config.skills = {};

    if (Array.isArray(skills.include)) {
      config.skills.include = skills.include.map((v) => String(v));
    }
    if (Array.isArray(skills.exclude)) {
      config.skills.exclude = skills.exclude.map((v) => String(v));
    }
  }

  if (raw.agents && typeof raw.agents === 'object') {
    const agents = raw.agents as Record<string, unknown>;
    config.agents = {};
    if (Array.isArray(agents.exclude)) {
      config.agents.exclude = agents.exclude.map((v) => String(v));
    }
  }

  return config;
}

/**
 * Test if a skill name matches a glob pattern.
 * Supports `*` wildcard only.
 */
export function matchesGlob(name: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$');
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

/**
 * Determine if an agent id is excluded from sync. Default (no config) syncs all
 * agents; `agents.exclude: ["*"]` opts a repo out of agent sync entirely.
 */
export function isAgentExcluded(name: string, config: SyncConfig): boolean {
  if (!config.agents?.exclude || config.agents.exclude.length === 0) {
    return false;
  }
  return config.agents.exclude.some((pattern) => matchesGlob(name, pattern));
}
