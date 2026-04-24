import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename, extname, resolve } from 'node:path';
import type { PermissionProfile } from '../providers/interface.js';
import type { AuthResult } from '../providers/interface.js';
import type { RuntimeContext } from './types.js';

const execFileAsync = promisify(execFile);

export interface RuntimeContextInput {
  provider: string;
  command: string;
  sessionId: string;
  permissionProfile: PermissionProfile;
  promptTemplatePath?: string;
  auth: AuthResult;
  cwd?: string;
}

function normalizeList(values: string[]): string[] {
  return [
    ...new Set(
      values
        .filter(Boolean)
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ].sort();
}

function toNames(files: string[]): string[] {
  return normalizeList(files.map((value) => basename(value, extname(value))));
}

async function listFilesByExt(baseDir: string, ext: string): Promise<string[]> {
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
      .map((entry) => join(baseDir, entry.name));
    return toNames(files);
  } catch {
    return [];
  }
}

async function listSharedSkills(workspace: string): Promise<string[]> {
  const skillsBase = join(workspace, '.agents', 'skills');
  try {
    const entries = await readdir(skillsBase, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const marker = join(skillsBase, entry.name, 'SKILL.md');
      try {
        await stat(marker);
      } catch {
        continue;
      }
      names.push(entry.name);
    }
    return normalizeList(names);
  } catch {
    return [];
  }
}

async function collectHookNames(filePath: string): Promise<string[]> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const names = new Set<string>();

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (
          item &&
          typeof item === 'object' &&
          typeof (item as { event?: unknown }).event === 'string'
        ) {
          names.add((item as { event?: string }).event ?? '');
        }
      }
      return normalizeList(Array.from(names));
    }

    if (typeof parsed !== 'object' || parsed === null) return [];

    const hooks = parsed.hooks as Record<string, unknown> | undefined;
    if (Array.isArray(hooks)) {
      for (const item of hooks) {
        if (typeof item === 'string') {
          names.add(item);
          continue;
        }
        if (
          item &&
          typeof item === 'object' &&
          typeof (item as { event?: unknown }).event === 'string'
        ) {
          names.add((item as { event: string }).event);
        }
      }
      return normalizeList(Array.from(names));
    }

    if (hooks && typeof hooks === 'object') {
      for (const event of Object.keys(hooks)) {
        names.add(event);
      }
    }

    return normalizeList(Array.from(names));
  } catch {
    return [];
  }
}

async function hasFile(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function pickProviderExposed(
  provider: string,
  workspace: string
): Promise<{
  agents: string[];
  hooks: string[];
  configFiles: string[];
}> {
  const providers =
    provider === 'codex'
      ? {
          agentsDir: join(workspace, '.codex', 'agents'),
          hooksPath: join(workspace, '.codex', 'hooks.json'),
          configPath: join(workspace, '.codex', 'config.toml'),
          ext: '.toml',
        }
      : provider === 'gemini'
        ? {
            agentsDir: join(workspace, '.gemini', 'agents'),
            hooksPath: join(workspace, '.gemini', 'settings.json'),
            configPath: join(workspace, '.gemini', 'settings.json'),
            ext: '.md',
          }
        : null;

  if (!providers) {
    return Promise.resolve({ agents: [], hooks: [], configFiles: [] });
  }

  const ext = providers.ext;

  return Promise.all([
    listFilesByExt(providers.agentsDir, ext),
    collectHookNames(providers.hooksPath),
    (async () => {
      const configFiles: string[] = [];
      if (await hasFile(providers.configPath)) {
        configFiles.push(basename(resolve(providers.configPath)));
      }
      return configFiles;
    })(),
  ]).then(([agents, hooks, configFiles]) => ({
    agents,
    hooks,
    configFiles,
  }));
}

async function getBranch(workspace: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: workspace,
      timeout: 2000,
    });
    const branch = stdout.trim();
    if (!branch || branch === 'HEAD') return undefined;
    return branch;
  } catch {
    return undefined;
  }
}

export async function collectRuntimeContext(input: RuntimeContextInput): Promise<RuntimeContext> {
  const workspace = input.cwd ?? process.cwd();
  const [sharedSkills, providerExposed, branch] = await Promise.all([
    listSharedSkills(workspace),
    pickProviderExposed(input.provider, workspace),
    getBranch(workspace),
  ]);

  return {
    active: {
      provider: input.provider,
      command: input.command,
      sessionId: input.sessionId,
      permissionProfile: input.permissionProfile,
      cwd: workspace,
      ...(input.promptTemplatePath !== undefined
        ? { promptTemplatePath: input.promptTemplatePath }
        : {}),
      ...(branch ? { branch } : {}),
      auth: input.auth,
    },
    exposed: {
      sharedSkills,
      providerAgents: providerExposed.agents,
      providerHooks: providerExposed.hooks,
      providerConfigFiles: providerExposed.configFiles,
      provider: input.provider,
    },
  };
}
