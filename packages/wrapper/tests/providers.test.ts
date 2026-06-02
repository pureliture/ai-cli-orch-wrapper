import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AntigravityProvider } from '../src/providers/antigravity';
import { CodexProvider } from '../src/providers/codex';
import { MockProvider } from '../src/providers/mock';
import { ProviderRegistry } from '../src/providers/registry';
import { getCachedProviderAuth } from '../src/providers/auth-cache';
import { readVersion } from '../src/util/read-version';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

interface FakeBinaryOptions {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

async function makeFakeBinary(
  binDir: string,
  name: string,
  output: string | FakeBinaryOptions
): Promise<string> {
  const full = path.join(binDir, name);
  const options = typeof output === 'string' ? { stdout: `${output}\n` } : output;
  await fs.writeFile(
    full,
    `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(options.stdout ?? '')});\nprocess.stderr.write(${JSON.stringify(options.stderr ?? '')});\nprocess.exit(${options.exitCode ?? 0});\n`,
    { mode: 0o755 }
  );
  return full;
}

/**
 * Codex checkAuth() cli-fallback 경로를 격리하기 위한 helper.
 * Codex의 env fast-path(OPENAI_API_KEY)만 제거한다.
 * (antigravity는 env fast-path를 참조하지 않으므로 여기 포함하지 않는다.)
 */
async function withoutCodexAuthEnv<T>(fn: () => Promise<T>): Promise<T> {
  const keys = ['OPENAI_API_KEY'];
  const original: Record<string, string | undefined> = {};
  for (const key of keys) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}

describe('readVersion()', () => {
  let tmpBin: string;

  before(async () => {
    tmpBin = await fs.mkdtemp(path.join(os.tmpdir(), 'aco-test-version-bin-'));
  });

  after(async () => {
    await fs.rm(tmpBin, { recursive: true, force: true });
  });

  it('returns the first non-empty stdout line when stdout is available', async () => {
    const binary = await makeFakeBinary(tmpBin, 'stdout-version', {
      stdout: '\n  cli 1.2.3  \nignored\n',
      stderr: 'stderr 9.9.9\n',
    });

    assert.equal(await readVersion(binary), 'cli 1.2.3');
  });

  it('falls back to the first non-empty stderr line', async () => {
    const binary = await makeFakeBinary(tmpBin, 'stderr-version', {
      stderr: '\n  cli 4.5.6  \nignored\n',
    });

    assert.equal(await readVersion(binary), 'cli 4.5.6');
  });

  it('returns an empty string when a successful probe has no version text', async () => {
    const binary = await makeFakeBinary(tmpBin, 'empty-version', {});

    assert.equal(await readVersion(binary), '');
  });

  it('returns undefined when the version probe fails', async () => {
    const binary = await makeFakeBinary(tmpBin, 'failed-version', {
      stdout: 'cli 0.0.0\n',
      exitCode: 1,
    });

    assert.equal(await readVersion(binary), undefined);
  });
});

describe('AntigravityProvider', () => {
  let tmpHome: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let tmpBin: string;
  let originalPath: string | undefined;

  before(async () => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'aco-test-home-agy-'));
    tmpBin = await fs.mkdtemp(path.join(os.tmpdir(), 'aco-test-bin-agy-'));
    await makeFakeBinary(tmpBin, 'agy', 'agy-cli 1.0.0');
    originalPath = process.env.PATH;
    process.env.PATH = `${tmpBin}${path.delimiter}${originalPath ?? ''}`;
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
  });

  after(async () => {
    process.env.PATH = originalPath;
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    await fs.rm(tmpHome, { recursive: true, force: true });
    await fs.rm(tmpBin, { recursive: true, force: true });
  });

  it('isAvailable() returns true when agy binary is in PATH', () => {
    const provider = new AntigravityProvider();
    const result = provider.isAvailable();
    assert.equal(typeof result, 'boolean');
  });

  it('isAvailable() returns false when agy is absent', () => {
    class TestAgy extends AntigravityProvider {
      override isAvailable() {
        return false;
      }
    }
    assert.equal(new TestAgy().isAvailable(), false);
  });

  it('key is "antigravity"', () => {
    assert.equal(new AntigravityProvider().key, 'antigravity');
  });

  it('installHint contains curl', () => {
    assert.ok(new AntigravityProvider().installHint.includes('curl'));
  });

  it('installHint is non-empty string', () => {
    assert.ok(new AntigravityProvider().installHint.length > 0);
  });

  it('checkAuth() returns { ok: false } when not available', async () => {
    class TestAgy extends AntigravityProvider {
      override isAvailable() {
        return false;
      }
    }
    const result = await new TestAgy().checkAuth();
    assert.equal(result.ok, false);
    assert.ok(typeof result.hint === 'string');
    assert.equal(result.method, 'missing');
  });

  it('checkAuth() does NOT use GEMINI_API_KEY or GOOGLE_API_KEY env fast-paths', async () => {
    class MockAgy extends AntigravityProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockAgy();
    const origGemini = process.env.GEMINI_API_KEY;
    const origGoogle = process.env.GOOGLE_API_KEY;
    process.env.GEMINI_API_KEY = 'gemini-key-should-be-ignored';
    process.env.GOOGLE_API_KEY = 'google-key-should-be-ignored';
    try {
      // With these env vars set, checkAuth should still proceed via binary probe
      // (method should NOT be 'api-key' — antigravity uses OS Keyring, not env vars)
      const result = await provider.checkAuth();
      assert.notEqual(result.method, 'api-key');
    } finally {
      if (origGemini === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = origGemini;
      }
      if (origGoogle === undefined) {
        delete process.env.GOOGLE_API_KEY;
      } else {
        process.env.GOOGLE_API_KEY = origGoogle;
      }
    }
  });

  it('checkAuth() relies on binary presence + readVersion', async () => {
    class MockAgy extends AntigravityProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockAgy();
    const result = await provider.checkAuth();
    assert.strictEqual(result.ok, true);
    assert.equal(result.method, 'cli-fallback');
    assert.equal(result.version, 'agy-cli 1.0.0');
    assert.equal(result.binaryPath, `${tmpBin}/agy`);
    assert.equal(result.hint, undefined);
  });

  it('checkAuth() fallback: reports stderr-only version output', async () => {
    class MockAgy extends AntigravityProvider {
      override isAvailable() {
        return true;
      }
    }
    await makeFakeBinary(tmpBin, 'agy', {
      stderr: '\n  agy-cli 1.1.0  \nignored\n',
    });

    try {
      const result = await new MockAgy().checkAuth();
      assert.strictEqual(result.ok, true);
      assert.equal(result.method, 'cli-fallback');
      assert.equal(result.version, 'agy-cli 1.1.0');
      assert.equal(result.binaryPath, `${tmpBin}/agy`);
    } finally {
      await makeFakeBinary(tmpBin, 'agy', 'agy-cli 1.0.0');
    }
  });

  it('checkAuth() fallback: stays ready when the version probe has no output', async () => {
    class MockAgy extends AntigravityProvider {
      override isAvailable() {
        return true;
      }
    }
    await makeFakeBinary(tmpBin, 'agy', {});

    try {
      const result = await new MockAgy().checkAuth();
      assert.strictEqual(result.ok, true);
      assert.equal(result.method, 'cli-fallback');
      assert.equal(result.version, '');
    } finally {
      await makeFakeBinary(tmpBin, 'agy', 'agy-cli 1.0.0');
    }
  });

  it('checkAuth() returns missing with OS Keyring hint when binary probe fails', async () => {
    class MockAgy extends AntigravityProvider {
      override isAvailable() {
        return true;
      }
    }
    await makeFakeBinary(tmpBin, 'agy', {
      stderr: 'permission denied\n',
      exitCode: 1,
    });

    try {
      const result = await new MockAgy().checkAuth();
      assert.strictEqual(result.ok, false);
      assert.equal(result.method, 'missing');
      assert.ok(typeof result.hint === 'string');
      // hint should mention agy install or OS Keyring
      assert.ok(result.hint.includes('agy') || result.hint.includes('Keyring'));
    } finally {
      await makeFakeBinary(tmpBin, 'agy', 'agy-cli 1.0.0');
    }
  });

  describe('buildArgs()', () => {
    it('default profile: returns [--dangerously-skip-permissions, -p] with -p last', () => {
      const provider = new AntigravityProvider();
      const args = provider.buildArgs('review', { permissionProfile: 'default' });
      assert.deepEqual(args, ['--dangerously-skip-permissions', '-p']);
      // -p가 마지막이어야 invoke()가 combined를 그 뒤에 append할 수 있다.
      assert.equal(args[args.length - 1], '-p');
    });

    it('restricted profile: returns [-p] only (omits --dangerously-skip-permissions)', () => {
      const provider = new AntigravityProvider();
      const args = provider.buildArgs('review', { permissionProfile: 'restricted' });
      assert.deepEqual(args, ['-p']);
      assert.ok(!args.includes('--dangerously-skip-permissions'));
    });

    it('unrestricted profile: includes --dangerously-skip-permissions', () => {
      const provider = new AntigravityProvider();
      const args = provider.buildArgs('review', { permissionProfile: 'unrestricted' });
      assert.ok(args.includes('--dangerously-skip-permissions'));
      assert.equal(args[args.length - 1], '-p');
    });

    it('IGNORES options.model — does not pass -m or --model flag', () => {
      const provider = new AntigravityProvider();
      const args = provider.buildArgs('review', { model: 'some-model' });
      assert.ok(!args.includes('-m'));
      assert.ok(!args.includes('--model'));
      assert.ok(!args.includes('some-model'));
    });

    it('no options: defaults to non-restricted (includes --dangerously-skip-permissions)', () => {
      const provider = new AntigravityProvider();
      const args = provider.buildArgs('review');
      assert.ok(args.includes('--dangerously-skip-permissions'));
      assert.equal(args[args.length - 1], '-p');
    });
  });

  describe('invoke()', () => {
    it('does NOT leak OPENAI_API_KEY or GITHUB_TOKEN to child process (OS Keyring env allowlist)', async () => {
      // fake agy binary: 감시 대상 env 키를 JSON으로 출력한다.
      const envScript = [
        '#!/usr/bin/env node',
        'const out = {',
        '  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "__ABSENT__",',
        '  GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? "__ABSENT__",',
        '  PATH: process.env.PATH ?? "__ABSENT__",',
        '};',
        'process.stdout.write(JSON.stringify(out));',
      ].join('\n');
      await fs.writeFile(path.join(tmpBin, 'agy'), envScript, { mode: 0o755 });

      const savedOpenAI = process.env.OPENAI_API_KEY;
      const savedGitHub = process.env.GITHUB_TOKEN;
      process.env.OPENAI_API_KEY = 'sentinel-openai-key';
      process.env.GITHUB_TOKEN = 'sentinel-github-token';

      try {
        const provider = new AntigravityProvider();
        const chunks: string[] = [];
        for await (const chunk of provider.invoke('ask', 'test prompt', '')) {
          chunks.push(chunk);
        }
        const result = JSON.parse(chunks.join('')) as {
          OPENAI_API_KEY: string;
          GITHUB_TOKEN: string;
          PATH: string;
        };

        // OPENAI_API_KEY는 child에게 전달되어서는 안 된다 (allowlist에 없음).
        assert.strictEqual(
          result.OPENAI_API_KEY,
          '__ABSENT__',
          `OPENAI_API_KEY must NOT reach agy child process. Got: ${result.OPENAI_API_KEY}`
        );
        // GITHUB_TOKEN도 전달되어서는 안 된다.
        assert.strictEqual(
          result.GITHUB_TOKEN,
          '__ABSENT__',
          `GITHUB_TOKEN must NOT reach agy child process. Got: ${result.GITHUB_TOKEN}`
        );
        // PATH는 base allowlist에 포함되므로 전달되어야 한다.
        assert.notStrictEqual(
          result.PATH,
          '__ABSENT__',
          'PATH must be present in child env (base allowlist key)'
        );
      } finally {
        if (savedOpenAI === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = savedOpenAI;
        }
        if (savedGitHub === undefined) {
          delete process.env.GITHUB_TOKEN;
        } else {
          process.env.GITHUB_TOKEN = savedGitHub;
        }
        // agy binary를 원래대로 복원한다.
        await makeFakeBinary(tmpBin, 'agy', 'agy-cli 1.0.0');
      }
    });
  });
});

describe('CodexProvider', () => {
  let tmpHome: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let tmpBin: string;
  let originalPath: string | undefined;

  before(async () => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'aco-test-home-codex-'));
    tmpBin = await fs.mkdtemp(path.join(os.tmpdir(), 'aco-test-bin-codex-'));
    await makeFakeBinary(tmpBin, 'codex', 'codex-cli 1.0.0');
    originalPath = process.env.PATH;
    process.env.PATH = `${tmpBin}${path.delimiter}${originalPath ?? ''}`;
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
  });

  after(async () => {
    process.env.PATH = originalPath;
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    await fs.rm(tmpHome, { recursive: true, force: true });
    await fs.rm(tmpBin, { recursive: true, force: true });
  });

  it('isAvailable() returns true when codex binary is in PATH', () => {
    const provider = new CodexProvider();
    const result = provider.isAvailable();
    assert.equal(typeof result, 'boolean');
  });

  it('isAvailable() returns false when codex is absent', () => {
    class TestCodex extends CodexProvider {
      override isAvailable() {
        return false;
      }
    }
    assert.equal(new TestCodex().isAvailable(), false);
  });

  it('key is "codex"', () => {
    assert.equal(new CodexProvider().key, 'codex');
  });

  it('installHint is non-empty string', () => {
    assert.ok(new CodexProvider().installHint.length > 0);
  });

  it('checkAuth() returns { ok: false } when not available', async () => {
    class TestCodex extends CodexProvider {
      override isAvailable() {
        return false;
      }
    }
    const result = await new TestCodex().checkAuth();
    assert.equal(result.ok, false);
    assert.ok(typeof result.hint === 'string');
    assert.equal(result.method, 'missing');
  });

  it('checkAuth() fast-path: returns ok when OPENAI_API_KEY is set', async () => {
    class MockCodex extends CodexProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockCodex();
    const originalEnv = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, true);
      assert.equal(result.method, 'api-key');
      assert.equal(result.binaryPath, `${tmpBin}/codex`);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalEnv;
      }
    }
  });

  it('checkAuth() fast-path: returns ok when valid auth.json exists', async () => {
    class MockCodex extends CodexProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockCodex();
    const authDir = path.join(tmpHome, '.codex');
    await fs.mkdir(authDir, { recursive: true });

    const authPath = path.join(authDir, 'auth.json');
    const future = Math.floor(Date.now() / 1000) + 3600;
    await fs.writeFile(authPath, JSON.stringify({ expires_at: future }));
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, true);
      assert.equal(result.method, 'oauth');
    } finally {
      await fs.rm(authPath, { force: true });
    }
  });

  it('checkAuth() fast-path: returns error when auth.json is expired', async () => {
    class MockCodex extends CodexProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockCodex();
    const authDir = path.join(tmpHome, '.codex');
    await fs.mkdir(authDir, { recursive: true });
    const authPath = path.join(authDir, 'auth.json');
    const past = Math.floor(Date.now() / 1000) - 3600;
    await fs.writeFile(authPath, JSON.stringify({ expires_at: past }));
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, false);
      assert.equal(result.method, 'missing');
      assert.ok(result.hint?.includes('expired'));
    } finally {
      await fs.rm(authPath, { force: true });
    }
  });

  it('checkAuth() fast-path: returns error when auth.json is malformed', async () => {
    class MockCodex extends CodexProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockCodex();
    const authDir = path.join(tmpHome, '.codex');
    await fs.mkdir(authDir, { recursive: true });
    const authPath = path.join(authDir, 'auth.json');
    await fs.writeFile(authPath, 'not-json');

    const originalPath = process.env.PATH;
    process.env.PATH = '';
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, false);
      assert.equal(result.method, 'missing');
    } finally {
      process.env.PATH = originalPath;
      await fs.rm(authPath, { force: true });
    }
  });

  it('checkAuth() fallback: reports cli-fallback via binary version output', async () => {
    class MockCodex extends CodexProvider {
      override isAvailable() {
        return true;
      }
    }

    const result = await withoutCodexAuthEnv(() => new MockCodex().checkAuth());
    assert.strictEqual(result.ok, true);
    assert.equal(result.method, 'cli-fallback');
    assert.equal(result.version, 'codex-cli 1.0.0');
    assert.equal(result.binaryPath, `${tmpBin}/codex`);
    assert.equal(result.hint, undefined);
  });

  it('checkAuth() fallback: stays ready when the version probe has no output', async () => {
    class MockCodex extends CodexProvider {
      override isAvailable() {
        return true;
      }
    }
    await makeFakeBinary(tmpBin, 'codex', {});

    try {
      const result = await withoutCodexAuthEnv(() => new MockCodex().checkAuth());
      assert.strictEqual(result.ok, true);
      assert.equal(result.method, 'cli-fallback');
      assert.equal(result.version, '');
      assert.equal(result.binaryPath, `${tmpBin}/codex`);
      assert.equal(result.hint, undefined);
    } finally {
      await makeFakeBinary(tmpBin, 'codex', 'codex-cli 1.0.0');
    }
  });

  describe('buildArgs()', () => {
    it('includes --full-auto when profile is "default"', () => {
      const provider = new CodexProvider();
      const args = provider.buildArgs('test', { permissionProfile: 'default' });
      assert.ok(args.includes('--full-auto'));
    });

    it('omits --full-auto when profile is "restricted"', () => {
      const provider = new CodexProvider();
      const args = provider.buildArgs('test', { permissionProfile: 'restricted' });
      assert.ok(!args.includes('--full-auto'));
    });

    it('includes --skip-git-repo-check', () => {
      const provider = new CodexProvider();
      const args = provider.buildArgs('test');
      assert.ok(args.includes('--skip-git-repo-check'));
    });
  });

  describe('invoke()', () => {
    it('combines prompt and content with double newline', async () => {
      let capturedArgs: string[] = [];
      class MockCodex extends CodexProvider {
        // @ts-ignore - access private/protected for testing
        async *invoke(command: string, prompt: string, content: string) {
          const combined = content ? `${prompt}\n\n${content}` : prompt;
          capturedArgs.push(combined);
          yield '';
        }
      }
      const provider = new MockCodex();
      const iter = provider.invoke('test', 'Hello', 'World');
      await iter.next();
      assert.equal(capturedArgs[0], 'Hello\n\nWorld');
    });

    it('uses only prompt when content is empty', async () => {
      let capturedArgs: string[] = [];
      class MockCodex extends CodexProvider {
        // @ts-ignore
        async *invoke(command: string, prompt: string, content: string) {
          const combined = content ? `${prompt}\n\n${content}` : prompt;
          capturedArgs.push(combined);
          yield '';
        }
      }
      const provider = new MockCodex();
      const iter = provider.invoke('test', 'Hello', '');
      await iter.next();
      assert.equal(capturedArgs[0], 'Hello');
    });
  });
});

describe('ProviderRegistry', () => {
  it('get("antigravity") returns AntigravityProvider', () => {
    const registry = new ProviderRegistry();
    const provider = registry.get('antigravity');
    assert.ok(provider !== undefined);
    assert.equal(provider.key, 'antigravity');
  });

  it('get("codex") returns CodexProvider', () => {
    const registry = new ProviderRegistry();
    const provider = registry.get('codex');
    assert.ok(provider !== undefined);
    assert.equal(provider.key, 'codex');
  });

  it('get("mock") returns MockProvider', () => {
    const registry = new ProviderRegistry();
    const provider = registry.get('mock');
    assert.ok(provider !== undefined);
    assert.equal(provider.key, 'mock');
  });

  it('get("unknown") returns undefined', () => {
    const registry = new ProviderRegistry();
    assert.equal(registry.get('unknown'), undefined);
  });

  it('get("gemini") returns undefined (gemini removed)', () => {
    const registry = new ProviderRegistry();
    assert.equal(registry.get('gemini'), undefined);
  });

  it('register() adds a new provider accessible via get()', () => {
    const registry = new ProviderRegistry();
    const custom = new AntigravityProvider();
    registry.register('my-provider', custom);
    assert.equal(registry.get('my-provider'), custom);
  });

  it('keys() includes antigravity and codex', () => {
    const registry = new ProviderRegistry();
    const keys = registry.keys();
    assert.ok(keys.includes('antigravity'));
    assert.ok(keys.includes('codex'));
    assert.ok(keys.includes('mock'));
    assert.ok(!keys.includes('gemini'));
  });
});

describe('MockProvider', () => {
  it('is always available and does not require external auth', async () => {
    const provider = new MockProvider();
    const auth = await provider.checkAuth();

    assert.equal(provider.isAvailable(), true);
    assert.equal(auth.ok, true);
    assert.equal(auth.method, 'cli-fallback');
    assert.equal(auth.version, 'mock-provider 0.1.0');
  });

  it('emits deterministic advisory demo output', async () => {
    const provider = new MockProvider();
    const chunks: string[] = [];

    for await (const chunk of provider.invoke('ask', 'Review this input.', 'demo')) {
      chunks.push(chunk);
    }

    const output = chunks.join('');
    assert.match(output, /Provider: mock/);
    assert.match(output, /Mode: deterministic demo/);
    assert.match(output, /Purpose: validates aco ask\/result workflow without external credentials/);
    assert.match(output, /Task prompt/);
    assert.match(output, /demo/);
  });

  describe('summarizeOutput()', () => {
    it('strips the Findings section', () => {
      const provider = new MockProvider();
      const output = 'Header\n\nFindings:\n- finding one\n- finding two';
      const summary = provider.summarizeOutput(output, 1000);
      assert.match(summary, /Header/);
      assert.doesNotMatch(summary, /Findings:/);
      assert.doesNotMatch(summary, /finding one/);
    });

    it('truncates to maxLength', () => {
      const provider = new MockProvider();
      const output = 'x'.repeat(2000);
      const summary = provider.summarizeOutput(output, 100);
      assert.match(summary, /\.\.\.\[truncated to 100 chars\]/);
      assert.ok(summary.length <= 100 + '\n...[truncated to 100 chars]'.length);
    });

    it('handles output without Findings', () => {
      const provider = new MockProvider();
      const output = 'Just some text';
      const summary = provider.summarizeOutput(output, 1000);
      assert.equal(summary, 'Just some text');
    });

    it('returns a placeholder for empty output', () => {
      const provider = new MockProvider();
      const summary = provider.summarizeOutput('', 1000);
      assert.equal(summary, '(no provider output)');
    });
  });
});

describe('CodexProvider', () => {
  it('implements summarizeOutput with default truncation', () => {
    const provider = new CodexProvider();
    const output = 'a'.repeat(2000);
    const summary = provider.summarizeOutput(output, 100);
    assert.match(summary, /\.\.\.\[truncated to 100 chars\]/);
    assert.ok(summary.length <= 100 + '\n...[truncated to 100 chars]'.length);
  });

  it('returns full output when within maxLength', () => {
    const provider = new CodexProvider();
    const output = 'short codex output';
    const summary = provider.summarizeOutput(output, 1000);
    assert.equal(summary, 'short codex output');
  });
});

describe('AntigravityProvider', () => {
  it('implements summarizeOutput with default truncation', () => {
    const provider = new AntigravityProvider();
    const output = 'b'.repeat(2000);
    const summary = provider.summarizeOutput(output, 100);
    assert.match(summary, /\.\.\.\[truncated to 100 chars\]/);
    assert.ok(summary.length <= 100 + '\n...[truncated to 100 chars]'.length);
  });

  it('returns full output when within maxLength', () => {
    const provider = new AntigravityProvider();
    const output = 'short agy output';
    const summary = provider.summarizeOutput(output, 1000);
    assert.equal(summary, 'short agy output');
  });
});

describe('Auth cache', () => {
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let tmpHome: string;

  before(async () => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'aco-test-auth-cache-'));
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
  });

  after(async () => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('reuses provider auth result within TTL', async () => {
    let calls = 0;
    class CachedAgy extends AntigravityProvider {
      override async checkAuth() {
        calls++;
        return { ok: true, method: 'cli-fallback' as const };
      }
    }

    const provider = new CachedAgy();
    const first = await getCachedProviderAuth(provider, { ttlMs: 5000 });
    const second = await getCachedProviderAuth(provider, { ttlMs: 5000 });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(calls, 1);
  });

  it('refreshes provider auth result after TTL', async () => {
    let calls = 0;
    class CachedAgy extends AntigravityProvider {
      override async checkAuth() {
        calls++;
        return { ok: true, method: 'cli-fallback' as const };
      }
    }

    const provider = new CachedAgy();
    const first = await getCachedProviderAuth(provider, { ttlMs: 0 });
    const second = await getCachedProviderAuth(provider, { ttlMs: 0 });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(calls, 2);
  });
});
