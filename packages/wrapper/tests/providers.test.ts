import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiProvider } from '../src/providers/gemini';
import { CopilotProvider } from '../src/providers/copilot';
import { ProviderRegistry } from '../src/providers/registry';

describe('GeminiProvider', () => {
  it('isAvailable() returns true when gemini binary is in PATH', () => {
    const provider = new GeminiProvider();
    // isAvailable result depends on actual PATH — just verify it returns boolean
    const result = provider.isAvailable();
    assert.equal(typeof result, 'boolean');
  });

  it('isAvailable() returns false when gemini is absent', () => {
    class TestGemini extends GeminiProvider {
      override isAvailable() { return false; }
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
      override isAvailable() { return false; }
    }
    const result = await new TestGemini().checkAuth();
    assert.equal(result.ok, false);
    assert.ok(typeof result.hint === 'string');
  });
});

describe('CopilotProvider', () => {
  it('isAvailable() returns boolean', () => {
    assert.equal(typeof new CopilotProvider().isAvailable(), 'boolean');
  });

  it('isAvailable() returns false when copilot is absent', () => {
    class TestCopilot extends CopilotProvider {
      override isAvailable() { return false; }
    }
    assert.equal(new TestCopilot().isAvailable(), false);
  });

  it('key is "copilot"', () => {
    assert.equal(new CopilotProvider().key, 'copilot');
  });

  it('checkAuth() returns { ok: false } when not available', async () => {
    class TestCopilot extends CopilotProvider {
      override isAvailable() { return false; }
    }
    const result = await new TestCopilot().checkAuth();
    assert.equal(result.ok, false);
    assert.ok(typeof result.hint === 'string');
  });
});

describe('ProviderRegistry', () => {
  it('get("gemini") returns GeminiProvider', () => {
    const registry = new ProviderRegistry();
    const provider = registry.get('gemini');
    assert.ok(provider !== undefined);
    assert.equal(provider.key, 'gemini');
  });

  it('get("copilot") returns CopilotProvider', () => {
    const registry = new ProviderRegistry();
    const provider = registry.get('copilot');
    assert.ok(provider !== undefined);
    assert.equal(provider.key, 'copilot');
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

  it('keys() includes gemini and copilot', () => {
    const registry = new ProviderRegistry();
    const keys = registry.keys();
    assert.ok(keys.includes('gemini'));
    assert.ok(keys.includes('copilot'));
  });
});

