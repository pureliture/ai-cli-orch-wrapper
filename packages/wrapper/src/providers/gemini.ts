import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { which } from '../util/which.js';
import type { AuthResult, InvokeOptions, IProvider, PermissionProfile } from './interface.js';

const execFileAsync = promisify(execFile);

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
      await execFileAsync('gemini', ['--version'], { timeout: 5000 });
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

  async *invoke(prompt: string, content: string, options?: InvokeOptions): AsyncIterable<string> {
    const binary = which('gemini');
    if (!binary) throw new Error('gemini CLI not found in PATH');

    const args = [...this.buildArgs('', options), `${prompt}\n\n${content}`];
    yield* spawnStream(binary, args, options);
  }
}

async function* spawnStream(binary: string, args: string[], options?: InvokeOptions): AsyncIterable<string> {
  const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  if (child.pid !== undefined) {
    options?.onPid?.(child.pid);
  }

  child.stdin.end();

  // Drain stderr to prevent buffer deadlock; ignore content
  child.stderr.resume();

  for await (const chunk of child.stdout) {
    yield (chunk as Buffer).toString();
  }

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`gemini exited with code ${code}`));
      else resolve();
    });
    child.on('error', reject);
  });
}
