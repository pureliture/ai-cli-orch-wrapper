import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiProvider } from '../src/providers/gemini';
import { CodexProvider } from '../src/providers/codex';
import { ProviderRegistry } from '../src/providers/registry';
import { getCachedProviderAuth } from '../src/providers/auth-cache';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

async function makeFakeBinary(binDir: string, name: string, output: string): Promise<string> {
  const full = path.join(binDir, name);
  await fs.writeFile(
    full,
    `#!/usr/bin/env sh\nprintf "%s\\n" "${output}"\n`,
    { mode: 0o755 }
  );
  return full;
}

describe('GeminiProvider', () => {
  let tmpHome: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;
  let tmpBin: string;
  let originalPath: string | undefined;

  before(async () => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'aco-test-home-'));
    tmpBin = await fs.mkdtemp(path.join(os.tmpdir(), 'aco-test-bin-gemini-'));
    await makeFakeBinary(tmpBin, 'gemini', 'gemini-cli 3.0.0');
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

  it('isAvailable() returns true when gemini binary is in PATH', () => {
    const provider = new GeminiProvider();
    const result = provider.isAvailable();
    assert.equal(typeof result, 'boolean');
  });

  it('isAvailable() returns false when gemini is absent', () => {
    class TestGemini extends GeminiProvider {
      override isAvailable() {
        return false;
      }
    }
    assert.equal(new TestGemini().isAvailable(), false);
  });

  it('key is "gemini"', () => {
    assert.equal(new GeminiProvider().key, 'gemini');
  });

  it('installHint is non-empty string', () => {
    assert.ok(new GeminiProvider().installHint.length > 0);
  });

  it('checkAuth() returns { ok: false } when not available', async () => {
    class TestGemini extends GeminiProvider {
      override isAvailable() {
        return false;
      }
    }
    const result = await new TestGemini().checkAuth();
    assert.equal(result.ok, false);
    assert.ok(typeof result.hint === 'string');
    assert.equal(result.method, 'missing');
  });

  it('checkAuth() fast-path: returns ok when GEMINI_API_KEY is set', async () => {
    class MockGemini extends GeminiProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockGemini();
    const originalEnv = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, true);
      assert.equal(result.method, 'api-key');
      assert.equal(result.binaryPath, `${tmpBin}/gemini`);
      assert.equal(result.hint, undefined);
      assert.equal(JSON.stringify(result).includes('test-key'), false);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalEnv;
      }
    }
  });

  it('checkAuth() fast-path: returns ok when GOOGLE_API_KEY is set', async () => {
    class MockGemini extends GeminiProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockGemini();
    const originalEnv = process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_API_KEY = 'test-key';
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, true);
      assert.equal(result.method, 'api-key');
      assert.equal(result.binaryPath, `${tmpBin}/gemini`);
      assert.equal(JSON.stringify(result).includes('test-key'), false);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.GOOGLE_API_KEY;
      } else {
        process.env.GOOGLE_API_KEY = originalEnv;
      }
    }
  });

  it('checkAuth() fast-path: returns ok when oauth_creds.json exists', async () => {
    class MockGemini extends GeminiProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockGemini();
    const credsDir = path.join(tmpHome, '.gemini');
    await fs.mkdir(credsDir, { recursive: true });
    const credsPath = path.join(credsDir, 'oauth_creds.json');
    await fs.writeFile(credsPath, '{}');
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, true);
      assert.equal(result.method, 'oauth');
      assert.equal(result.hint, undefined);
      assert.equal(result.binaryPath, `${tmpBin}/gemini`);
    } finally {
      await fs.rm(credsPath, { force: true });
    }
  });

  it('checkAuth() fallback: reports cli-fallback via binary version output', async () => {
    class MockGemini extends GeminiProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockGemini();
    const result = await provider.checkAuth();
    assert.strictEqual(result.ok, true);
    assert.equal(result.method, 'cli-fallback');
    assert.equal(result.version, 'gemini-cli 3.0.0');
    assert.equal(result.binaryPath, `${tmpBin}/gemini`);
    assert.equal(result.hint, undefined);
  });

  it('checkAuth() fast-path: returns error when oauth_creds.json is a directory', async () => {
    class MockGemini extends GeminiProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockGemini();
    const credsDir = path.join(tmpHome, '.gemini');
    await fs.mkdir(credsDir, { recursive: true });
    const credsPath = path.join(credsDir, 'oauth_creds.json');
    await fs.mkdir(credsPath, { recursive: true });

    const originalPath = process.env.PATH;
    process.env.PATH = '';
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, false);
    } finally {
      process.env.PATH = originalPath;
      await fs.rm(credsPath, { recursive: true, force: true });
    }
  });

  it('checkAuth() fast-path: returns error when oauth_creds.json is malformed', async () => {
    class MockGemini extends GeminiProvider {
      override isAvailable() {
        return true;
      }
    }
    const provider = new MockGemini();
    const credsDir = path.join(tmpHome, '.gemini');
    await fs.mkdir(credsDir, { recursive: true });
    const credsPath = path.join(credsDir, 'oauth_creds.json');
    await fs.writeFile(credsPath, 'not-json');

    const originalPath = process.env.PATH;
    process.env.PATH = '';
    try {
      const result = await provider.checkAuth();
      assert.strictEqual(result.ok, false);
    } finally {
      process.env.PATH = originalPath;
      await fs.rm(credsPath, { force: true });
    }
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
  it('get("gemini") returns GeminiProvider', () => {
    const registry = new ProviderRegistry();
    const provider = registry.get('gemini');
    assert.ok(provider !== undefined);
    assert.equal(provider.key, 'gemini');
  });

  it('get("codex") returns CodexProvider', () => {
    const registry = new ProviderRegistry();
    const provider = registry.get('codex');
    assert.ok(provider !== undefined);
    assert.equal(provider.key, 'codex');
  });

  it('get("unknown") returns undefined', () => {
    const registry = new ProviderRegistry();
    assert.equal(registry.get('unknown'), undefined);
  });

  it('register() adds a new provider accessible via get()', () => {
    const registry = new ProviderRegistry();
    const custom = new GeminiProvider();
    registry.register('my-provider', custom);
    assert.equal(registry.get('my-provider'), custom);
  });

  it('keys() includes gemini and codex', () => {
    const registry = new ProviderRegistry();
    const keys = registry.keys();
    assert.ok(keys.includes('gemini'));
    assert.ok(keys.includes('codex'));
    assert.equal(keys.length, 2);
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
    class CachedGemini extends GeminiProvider {
      override async checkAuth() {
        calls++;
        return { ok: true, method: 'api-key' };
      }
    }

    const provider = new CachedGemini();
    const first = await getCachedProviderAuth(provider, { ttlMs: 5000 });
    const second = await getCachedProviderAuth(provider, { ttlMs: 5000 });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(calls, 1);
  });

  it('refreshes provider auth result after TTL', async () => {
    let calls = 0;
    class CachedGemini extends GeminiProvider {
      override async checkAuth() {
        calls++;
        return { ok: true, method: 'api-key' };
      }
    }

    const provider = new CachedGemini();
    const first = await getCachedProviderAuth(provider, { ttlMs: 0 });
    const second = await getCachedProviderAuth(provider, { ttlMs: 0 });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(calls, 2);
  });
});
