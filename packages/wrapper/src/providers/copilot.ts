import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { which } from '../util/which.js';
import type { AuthResult, InvokeOptions, IProvider } from './interface.js';

const execFileAsync = promisify(execFile);

export class CopilotProvider implements IProvider {
  readonly key = 'copilot';
  readonly installHint = 'npm install -g @github/copilot\n  gh auth login  # GitHub CLI must be installed';

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
      await execFileAsync(gh, ['auth', 'status'], { timeout: 5000 });
      return { ok: true };
    } catch {
      return { ok: false, hint: 'gh auth login' };
    }
  }

  buildArgs(command: string, _options?: InvokeOptions): string[] {
    return ['--allow-all-tools', '--silent', '-p'];
  }

  async *invoke(prompt: string, content: string, _options?: InvokeOptions): AsyncIterable<string> {
    const binary = which('copilot');
    if (!binary) throw new Error('copilot CLI not found in PATH');

    const fullPrompt = content ? `${content}\n\n${prompt}` : prompt;
    const args = [...this.buildArgs(''), fullPrompt];
    yield* spawnStream(binary, args);
  }
}

async function* spawnStream(binary: string, args: string[]): AsyncIterable<string> {
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  for await (const chunk of child.stdout) {
    yield (chunk as Buffer).toString();
  }

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`copilot exited with code ${code}`));
      else resolve();
    });
    child.on('error', reject);
  });
}
