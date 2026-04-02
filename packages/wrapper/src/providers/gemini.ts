import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { which } from '../util/which.js';
import type { AuthResult, InvokeOptions, IProvider } from './interface.js';

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

  buildArgs(command: string, _options?: InvokeOptions): string[] {
    return ['--yolo', '-p'];
  }

  async *invoke(prompt: string, content: string, _options?: InvokeOptions): AsyncIterable<string> {
    const binary = which('gemini');
    if (!binary) throw new Error('gemini CLI not found in PATH');

    const args = [...this.buildArgs(''), `${prompt}\n\n${content}`];
    yield* spawnStream(binary, args, content);
  }
}

async function* spawnStream(binary: string, args: string[], _stdinContent: string): AsyncIterable<string> {
  const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  child.stdin.end();

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
