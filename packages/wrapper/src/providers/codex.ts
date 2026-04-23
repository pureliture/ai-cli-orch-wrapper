import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
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

    // 1. Fast path: Environment variables
    if (process.env.OPENAI_API_KEY) {
      return { ok: true };
    }

    // 2. Fast path: Local OAuth token file with expiration check
    try {
      const authPath = join(homedir(), '.codex', 'auth.json');
      const raw = await readFile(authPath, 'utf8');
      const data = JSON.parse(raw) as { expires_at?: number };
      if (typeof data.expires_at === 'number') {
        const now = Math.floor(Date.now() / 1000);
        if (data.expires_at < now) {
          return {
            ok: false,
            hint: 'Codex OAuth token expired. Run: codex login',
          };
        }
      }
      return { ok: true };
    } catch {
      // File missing or malformed - fall back to CLI check
    }

    // 3. Fallback: CLI execution
    try {
      await execFileAsync('codex', ['--version'], { timeout: AUTH_CHECK_TIMEOUT_MS });
      return { ok: true };
    } catch {
      return {
        ok: false,
        hint: 'codex login OR export OPENAI_API_KEY="..."',
      };
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
