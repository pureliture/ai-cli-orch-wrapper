import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { which } from '../util/which.js';
import { spawnStream } from '../util/spawn-stream.js';
import { buildProviderEnv } from '../util/provider-env.js';
import type { AuthResult, InvokeOptions, IProvider, PermissionProfile } from './interface.js';
import { readVersion } from '../util/read-version.js';
import { defaultSummarizeOutput } from '../util/summarize-output.js';

/**
 * Stable, neutral working directory for `agy` invocations.
 *
 * agy persists every cwd it runs in as a project in `~/.gemini/antigravity-cli`,
 * so inheriting aco's cwd (often an ephemeral temp/session/job dir) floods the
 * Antigravity sidebar with junk projects. Pinning a single fixed directory keeps
 * exactly one stable entry instead. Review content is passed via `-p`/stdin, not
 * read from cwd, so this does not affect delegation output.
 */
export function agyWorkspaceDir(): string {
  return join(homedir(), '.aco', 'agy-workspace');
}

export class AntigravityProvider implements IProvider {
  readonly key = 'antigravity';
  readonly installHint = 'curl -fsSL https://antigravity.google/cli/install.sh | bash';
  readonly icon = '🔵';

  isAvailable(): boolean {
    return which('agy') !== null;
  }

  /**
   * Limitation: checkAuth only verifies binary availability via `agy --version`;
   * it cannot validate the OS Keyring session (agy has no non-interactive
   * auth-status command); a stale session surfaces only at invoke time.
   */
  async checkAuth(): Promise<AuthResult> {
    const available = this.isAvailable();
    const binaryPath = which('agy');

    if (!available || !binaryPath) {
      return { ok: false, method: 'missing', hint: this.installHint };
    }

    // auth는 OS Keyring에 위임 — env var 또는 credential 파일 fast-path 없음.
    // binary 존재 + readVersion('agy') 결과만으로 인증 상태를 판단한다.
    try {
      const version = await readVersion('agy');
      if (version === undefined) throw new Error('probe failed');
      return { ok: true, method: 'cli-fallback', version, binaryPath };
    } catch {
      return {
        ok: false,
        method: 'missing',
        binaryPath,
        hint: 'agy 설치 또는 OS Keyring 인증 확인',
      };
    }
  }

  /**
   * agy CLI flag 빌더.
   *
   * 인수 형식: `agy [--dangerously-skip-permissions] -p "<combined>"`
   * combined는 invoke()에서 buildArgs 결과 끝에 append된다 (`-p`가 마지막 flag).
   *
   * - non-restricted → `--dangerously-skip-permissions` 추가
   * - restricted → 생략
   * - NOTE: agy에는 CLI model flag(-m/--model)가 없음. options.model은 무시된다.
   *   (model은 `/model` 커맨드로 out-of-band 선택)
   */
  buildArgs(command: string, options?: InvokeOptions): string[] {
    const profile: PermissionProfile = options?.permissionProfile ?? 'default';
    const base = ['-p'];
    if (profile !== 'restricted') {
      base.unshift('--dangerously-skip-permissions');
    }
    return base;
  }

  async *invoke(
    command: string,
    prompt: string,
    content: string,
    options?: InvokeOptions
  ): AsyncIterable<string> {
    const binary = which('agy');
    if (!binary) throw new Error('agy CLI not found in PATH');

    // agy는 OS Keyring 인증 방식을 사용하므로 auth env var가 필요 없다.
    // buildProviderEnv([])는 BASE_ENV_KEYS(PATH, HOME 등 기반 키)만 전달하고
    // OPENAI_API_KEY, GITHUB_TOKEN 등 민감 env를 child에 전달하지 않는다.
    const env = buildProviderEnv([]);
    const combined = content ? `${prompt}\n\n${content}` : prompt;
    const args = [...this.buildArgs(command, options), combined];
    // Pin agy to a stable neutral cwd so ephemeral invocation dirs are not
    // registered as Antigravity projects. See agyWorkspaceDir() above.
    const cwd = agyWorkspaceDir();
    await mkdir(cwd, { recursive: true });
    yield* spawnStream(binary, args, { processName: 'agy', stdin: 'pipe', env, cwd }, options);
  }

  summarizeOutput(output: string, maxLength: number): string {
    return defaultSummarizeOutput(output, maxLength);
  }
}
