import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { which } from '../util/which.js';
import { spawnStream } from '../util/spawn-stream.js';
import type { AuthResult, InvokeOptions, IProvider, PermissionProfile } from './interface.js';

const execFileAsync = promisify(execFile);

const AUTH_CHECK_TIMEOUT_MS = 5_000;

export class GeminiProvider implements IProvider {
  readonly key = 'gemini';
  readonly installHint = 'npm install -g @google/gemini-cli';

  isAvailable(): boolean {
    return which('gemini') !== null;
  }

  async checkAuth(): Promise<AuthResult> {
    if (!this.isAvailable()) {
      return { ok: false, hint: this.installHint };
    }
    try {
      await execFileAsync('gemini', ['--version'], { timeout: AUTH_CHECK_TIMEOUT_MS });
      return { ok: true };
    } catch {
      return { ok: false, hint: 'gemini auth login  # or run `gemini` interactively' };
    }
  }

  buildArgs(command: string, options?: InvokeOptions): string[] {
    const profile: PermissionProfile = options?.permissionProfile ?? 'default';
    const base = ['-p'];
    if (profile !== 'restricted') {
      base.unshift('--yolo');
    }
    return base;
  }

  async *invoke(command: string, prompt: string, content: string, options?: InvokeOptions): AsyncIterable<string> {
    const binary = which('gemini');
    if (!binary) throw new Error('gemini CLI not found in PATH');

    const args = [...this.buildArgs(command, options), `${prompt}\n\n${content}`];
    yield* spawnStream(binary, args, { processName: 'gemini', stdin: 'pipe' }, options);
  }
}
