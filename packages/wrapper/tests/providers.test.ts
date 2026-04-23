import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiProvider } from '../src/providers/gemini';
import { CodexProvider } from '../src/providers/codex';
import { ProviderRegistry } from '../src/providers/registry';

describe('GeminiProvider', () => {
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
  });
});

describe('CodexProvider', () => {
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
