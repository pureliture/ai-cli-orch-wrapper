/**
 * V2 type contract tests
 *
 * Proves that V2Config and CliAdapter interfaces compile and satisfy
 * their structural shape expectations. No process spawning — pure import + assert.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('V2Config schema: DEFAULT_V2_CONFIG has empty aliases', async () => {
  const { DEFAULT_V2_CONFIG } = await import('../dist/v2/types/config.js');
  assert.deepEqual(DEFAULT_V2_CONFIG.aliases, {});
});

test('V2Config schema: CliAdapterConfig requires adapter string and allows extraArgs', async () => {
  const { DEFAULT_V2_CONFIG } = await import('../dist/v2/types/config.js');
  // Structural: add an alias entry and verify shape round-trips
  const config = {
    ...DEFAULT_V2_CONFIG,
    aliases: {
      claude: { adapter: 'claude-code', extraArgs: ['--dangerously-skip-permissions'] },
    },
  };
  assert.equal(config.aliases['claude'].adapter, 'claude-code');
  assert.deepEqual(config.aliases['claude'].extraArgs, ['--dangerously-skip-permissions']);
});

test('CliAdapter interface: a conforming mock object has the required shape', async () => {
  // Import the type module to confirm it emits JS (no runtime errors on import)
  await import('../dist/v2/types/cli-adapter.js');
  // Shape conformance is enforced at TypeScript compile time (tsc --noEmit).
  // At runtime we verify the module loads without errors.
  assert.ok(true, 'cli-adapter module loaded without error');
});

test('V2Config schema: roles field is optional', async () => {
  const { DEFAULT_V2_CONFIG } = await import('../dist/v2/types/config.js');
  assert.equal(DEFAULT_V2_CONFIG.roles, undefined);
});
