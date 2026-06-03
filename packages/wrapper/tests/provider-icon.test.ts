import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { providerRegistry } from '../src/providers/registry.js';

describe('provider icon field (4.3, 4.4)', () => {
  it('antigravity exposes a blue circle icon', () => {
    assert.equal(providerRegistry.get('antigravity')?.icon, '🔵');
  });

  it('codex exposes a green circle icon', () => {
    assert.equal(providerRegistry.get('codex')?.icon, '🟢');
  });

  it('mock exposes a white circle icon', () => {
    assert.equal(providerRegistry.get('mock')?.icon, '⚪');
  });

  it('every registered provider declares a non-empty icon', () => {
    for (const key of providerRegistry.keys()) {
      const provider = providerRegistry.get(key);
      assert.ok(provider, `provider ${key} should resolve`);
      assert.equal(typeof provider?.icon, 'string');
      assert.ok((provider?.icon.length ?? 0) > 0, `provider ${key} should declare an icon`);
    }
  });
});
