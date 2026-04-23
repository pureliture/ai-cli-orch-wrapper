import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { which } from '../util/which.js';
import { spawnStream } from '../util/spawn-stream.js';
import type { AuthResult, InvokeOptions, IProvider, PermissionProfile } from './interface.js';

const execFileAsync = promisify(execFile);

const AUTH_CHECK_TIMEOUT_MS = 5_000;

export class CodexProvider implements IProvider {
  readonly key = 'codex';
  readonly installHint = 'npm install -g @openai/codex';

  isAvailable(): boolean {
    return which('codex') !== null;
  }

  async checkAuth(): Promise<AuthResult> {
    if (!this.isAvailable()) {
      return { ok: false, hint: this.installHint };
    }
    try {
      await execFileAsync('codex', ['--version'], { timeout: AUTH_CHECK_TIMEOUT_MS });
      return { ok: true };
    } catch {
      return { ok: false, hint: 'codex login' };
    }
  }

  buildArgs(command: string, options?: InvokeOptions): string[] {
    const profile: PermissionProfile = options?.permissionProfile ?? 'default';
    const args = ['exec', '--skip-git-repo-check'];
    if (profile !== 'restricted') {
      args.push('--full-auto');
    }
    return args;
  }

  async *invoke(
    command: string,
    prompt: string,
    content: string,
    options?: InvokeOptions
  ): AsyncIterable<string> {
    const binary = which('codex');
    if (!binary) throw new Error('codex CLI not found in PATH');

    const combined = content ? `${prompt}\n\n${content}` : prompt;
    const args = [...this.buildArgs(command, options), combined];
    yield* spawnStream(binary, args, { processName: 'codex', stdin: 'pipe' }, options);
  }
}
