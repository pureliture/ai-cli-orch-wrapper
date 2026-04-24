import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
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

    // 1. Fast path: Environment variables
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      return { ok: true };
    }

    // 2. Fast path: Local OAuth credentials file
    try {
      const credsPath = join(homedir(), '.gemini', 'oauth_creds.json');
      if (!(await stat(credsPath)).isFile()) {
        throw new Error('Not a file');
      }
      const raw = await readFile(credsPath, 'utf8');
      try {
        JSON.parse(raw);
        return { ok: true };
      } catch (e) {
        console.warn(
          'Failed to parse Gemini auth file:',
          e instanceof Error ? e.message : String(e)
        );
        // Fall back to CLI check
      }
    } catch {
      // Ignore and fall back to CLI check
    }

    // 3. Fallback: CLI execution
    try {
      await execFileAsync('gemini', ['--version'], { timeout: AUTH_CHECK_TIMEOUT_MS });
      return { ok: true };
    } catch {
      return {
        ok: false,
        hint: 'gemini auth login OR export GEMINI_API_KEY="..."',
      };
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

  async *invoke(
    command: string,
    prompt: string,
    content: string,
    options?: InvokeOptions
  ): AsyncIterable<string> {
    const binary = which('gemini');
    if (!binary) throw new Error('gemini CLI not found in PATH');

    const args = [...this.buildArgs(command, options), `${prompt}\n\n${content}`];
    yield* spawnStream(binary, args, { processName: 'gemini', stdin: 'pipe' }, options);
  }
}
