import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { which } from '../util/which.js';
import { spawnStream, writeTempInput } from '../util/spawn-stream.js';
import { buildProviderEnv } from '../util/provider-env.js';
import type { AuthResult, InvokeOptions, IProvider, PermissionProfile } from './interface.js';
import { readVersion } from '../util/read-version.js';
import { defaultSummarizeOutput } from '../util/summarize-output.js';

export class CodexProvider implements IProvider {
  readonly key = 'codex';
  readonly installHint = 'npm install -g @openai/codex';

  isAvailable(): boolean {
    return which('codex') !== null;
  }

  async checkAuth(): Promise<AuthResult> {
    const available = this.isAvailable();
    const binaryPath = which('codex');

    if (!available || !binaryPath) {
      return { ok: false, method: 'missing', hint: this.installHint };
    }

    const versionHint = {
      binaryPath,
    };

    // 1. Fast path: Environment variables
    if (process.env.OPENAI_API_KEY) {
      return { ok: true, method: 'api-key', ...versionHint };
    }

    // 2. Fast path: Local OAuth token file with expiration check
    try {
      const authPath = join(homedir(), '.codex', 'auth.json');
      const raw = await readFile(authPath, 'utf8');
      try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Invalid auth file format');
        }
        const expiresAt = (data as { expires_at?: number }).expires_at;
        if (expiresAt !== null && expiresAt !== undefined && typeof expiresAt === 'number') {
          const now = Math.floor(Date.now() / 1000);
          if (expiresAt < now) {
            return {
              ok: false,
              method: 'missing',
              hint: 'Codex OAuth token expired. Run: codex login',
              ...versionHint,
            };
          }
        }
        return { ok: true, method: 'oauth', ...versionHint };
      } catch (e) {
        console.warn(
          'Failed to parse Codex auth file:',
          e instanceof Error ? e.message : String(e)
        );
        // Fall back to CLI check
      }
    } catch {
      // File missing or read failed - fall back to CLI check
    }

    // 3. Fallback: CLI execution
    try {
      const version = await readVersion('codex');
      if (version === undefined) throw new Error('probe failed');
      return { ok: true, method: 'cli-fallback', version, ...versionHint };
    } catch {
      return {
        ok: false,
        method: 'missing',
        ...versionHint,
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
    if (options?.model) {
      args.push('-m', options.model);
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

    const env = buildProviderEnv(['OPENAI_API_KEY']);

    if (content) {
      const stdinFile = await writeTempInput(content);
      const args = [...this.buildArgs(command, options), prompt];
      yield* spawnStream(
        binary,
        args,
        { processName: 'codex', stdin: 'pipe', stdinFile, env },
        options
      );
    } else {
      const args = [...this.buildArgs(command, options), prompt];
      yield* spawnStream(binary, args, { processName: 'codex', stdin: 'pipe', env }, options);
    }
  }

  summarizeOutput(output: string, maxLength: number): string {
    return defaultSummarizeOutput(output, maxLength);
  }
}
