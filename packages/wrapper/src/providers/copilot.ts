import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { which } from '../util/which.js';
import { spawnStream } from '../util/spawn-stream.js';
import type { AuthResult, InvokeOptions, IProvider, PermissionProfile } from './interface.js';

const execFileAsync = promisify(execFile);

const AUTH_CHECK_TIMEOUT_MS = 5_000;

export class CopilotProvider implements IProvider {
  readonly key = 'copilot';
  readonly installHint =
    'npm install -g @github/copilot\n  gh auth login  # GitHub CLI must be installed';

  isAvailable(): boolean {
    return which('copilot') !== null;
  }

  async checkAuth(): Promise<AuthResult> {
    if (!this.isAvailable()) {
      return { ok: false, hint: this.installHint };
    }
    const gh = which('gh');
    if (!gh) {
      return { ok: false, hint: 'gh auth login  # Install GitHub CLI: https://cli.github.com' };
    }
    try {
      await execFileAsync(gh, ['auth', 'status'], { timeout: AUTH_CHECK_TIMEOUT_MS });
      return { ok: true };
    } catch {
      return { ok: false, hint: 'gh auth login' };
    }
  }

  buildArgs(command: string, options?: InvokeOptions): string[] {
    const profile: PermissionProfile = options?.permissionProfile ?? 'default';
    const base = ['--silent', '-p'];
    if (profile !== 'restricted') {
      base.unshift('--allow-all-tools');
    }
    return base;
  }

  async *invoke(
    command: string,
    prompt: string,
    content: string,
    options?: InvokeOptions
  ): AsyncIterable<string> {
    const binary = which('copilot');
    if (!binary) throw new Error('copilot CLI not found in PATH');

    const fullPrompt = content ? `${content}\n\n${prompt}` : prompt;
    const args = [...this.buildArgs(command, options), fullPrompt];
    yield* spawnStream(binary, args, { processName: 'copilot', stdin: 'ignore' }, options);
  }
}
