/**
 * Aco config tests
 *
 * Tests for readAcoConfig() covering CONFIG-01 (config read, missing file fallback, malformed JSON fallback).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'aco-config-test-'));
}

// Test 1: reads aliases and roles from a valid .wrapper.json
test('readAcoConfig reads aliases and roles from a valid config file', async () => {
  const dir = makeTempDir();
  const configPath = join(dir, '.wrapper.json');
  writeFileSync(
    configPath,
    JSON.stringify({
      aliases: {
        claude: { provider: 'claude_code', agent: 'developer' },
        gemini: { provider: 'gemini_cli', agent: 'developer' },
      },
      roles: {
        orchestrator: 'claude_code',
        reviewer: 'gemini_cli',
      },
    }),
    'utf8',
  );

  const { readAcoConfig } = await import('../dist/config/aco-config.js');
  const config = readAcoConfig(configPath);

  assert.equal(config.aliases['claude'].provider, 'claude_code');
  assert.equal(config.aliases['claude'].agent, 'developer');
  assert.equal(config.aliases['gemini'].provider, 'gemini_cli');
  assert.equal(config.roles['orchestrator'], 'claude_code');
  assert.equal(config.roles['reviewer'], 'gemini_cli');
});

// Test 2: returns empty defaults when file is missing (graceful fallback)
test('readAcoConfig returns empty defaults when config file is missing', async () => {
  const { readAcoConfig } = await import('../dist/config/aco-config.js');
  const config = readAcoConfig('/nonexistent/path/.wrapper.json');

  assert.deepEqual(config.aliases, {});
  assert.deepEqual(config.roles, {});
});

// Test 3: returns empty defaults when file contains malformed JSON
test('readAcoConfig returns empty defaults when JSON is malformed', async () => {
  const dir = makeTempDir();
  const configPath = join(dir, '.wrapper.json');
  writeFileSync(configPath, '{ this is not valid json }', 'utf8');

  const { readAcoConfig } = await import('../dist/config/aco-config.js');
  const config = readAcoConfig(configPath);

  assert.deepEqual(config.aliases, {});
  assert.deepEqual(config.roles, {});
});

// Test 4: arbitrary provider string passes through without validation (CONFIG-02)
test('readAcoConfig accepts arbitrary provider strings without validation', async () => {
  const dir = makeTempDir();
  const configPath = join(dir, '.wrapper.json');
  writeFileSync(
    configPath,
    JSON.stringify({
      aliases: {
        newai: { provider: 'some_future_provider_v99', agent: 'expert' },
      },
      roles: {},
    }),
    'utf8',
  );

  const { readAcoConfig } = await import('../dist/config/aco-config.js');
  const config = readAcoConfig(configPath);

  assert.equal(config.aliases['newai'].provider, 'some_future_provider_v99');
  assert.equal(config.aliases['newai'].agent, 'expert');
});
