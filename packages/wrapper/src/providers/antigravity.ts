import { which } from '../util/which.js';
import { spawnStream } from '../util/spawn-stream.js';
import type { AuthResult, InvokeOptions, IProvider, PermissionProfile } from './interface.js';
import { readVersion } from '../util/read-version.js';
import { defaultSummarizeOutput } from '../util/summarize-output.js';

export class AntigravityProvider implements IProvider {
  readonly key = 'antigravity';
  readonly installHint = 'curl -fsSL https://antigravity.google/cli/install.sh | bash';

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

    const combined = content ? `${prompt}\n\n${content}` : prompt;
    const args = [...this.buildArgs(command, options), combined];
    yield* spawnStream(binary, args, { processName: 'agy', stdin: 'pipe' }, options);
  }

  summarizeOutput(output: string, maxLength: number): string {
    return defaultSummarizeOutput(output, maxLength);
  }
}
