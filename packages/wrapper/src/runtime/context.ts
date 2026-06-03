import { providerRegistry } from '../providers/registry.js';
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
  // antigravity(agy)는 workspace custom-agent 등록 표면이 없고 workspace hooks/config도
  // 읽지 않으므로 provider-specific 노출 표면이 존재하지 않는다. → null로 두어
  // 아래 빈 결과 경로로 빠지게 한다.
  const providers =
    provider === 'codex'
      ? {
          agentsDir: join(workspace, '.codex', 'agents'),
          hooksPath: join(workspace, '.codex', 'hooks.json'),
          configPath: join(workspace, '.codex', 'config.toml'),
          ext: '.toml',
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
        configFiles.push(basename(providers.configPath));
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

/**
 * 여러 provider 입력을 받아 provider별 RuntimeContext를 수집한다.
 *
 * `aco ask`(선언적 멀티프로바이더)는 한 위임에 여러 provider가 참여할 수 있으므로
 * 단일 세션이 아닌 멀티 세션 모델이 필요하다. 각 provider는 독립된 session·auth를
 * 가지며, 이 함수는 입력 순서를 보존해 RuntimeContext 배열을 반환한다.
 *
 * `aco run`(단일 provider)은 계속 단일 입력 `collectRuntimeContext`를 사용한다.
 */
export async function collectRuntimeContexts(
  inputs: readonly RuntimeContextInput[]
): Promise<RuntimeContext[]> {
  return Promise.all(inputs.map((input) => collectRuntimeContext(input)));
}

export async function collectRuntimeContext(input: RuntimeContextInput): Promise<RuntimeContext> {
  const workspace = input.cwd ?? process.cwd();
  const [sharedSkills, providerExposed, branch] = await Promise.all([
    providerRegistry.get(input.provider) ? listSharedSkills(workspace) : Promise.resolve([]),
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
