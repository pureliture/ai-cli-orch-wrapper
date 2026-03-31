/**
 * Canonical command surface tests
 *
 * Locks the public CLI install/help/version/error surface to `aco`.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const PROJECT_ROOT = join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..');
const CLI_PATH = join(PROJECT_ROOT, 'dist', 'cli.js');
const PACKAGE_JSON_PATH = join(PROJECT_ROOT, 'package.json');
const README_PATH = join(PROJECT_ROOT, 'README.md');

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'aco-command-surface-test-'));
}

function writeConfig(dir: string): void {
  writeFileSync(join(dir, '.wrapper.json'), JSON.stringify({
    aliases: {
      claude: { provider: 'claude_code', agent: 'developer' },
    },
    roles: {
      orchestrator: 'claude_code',
      reviewer: 'gemini_cli',
    },
  }, null, 2), 'utf8');
}

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    env: process.env,
    encoding: 'utf8',
  });
}

test('package.json exposes aco as the only public bin', () => {
  const packageJsonContents = readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const packageJson = JSON.parse(packageJsonContents);

  assert.ok(packageJsonContents.includes('"aco": "dist/cli.js"'));
  assert.equal(packageJson.bin.aco, 'dist/cli.js');
  assert.ok(!('wrapper' in packageJson.bin));
});

test('help output uses aco as the visible command name', () => {
  const dir = makeTempDir();
  writeConfig(dir);

  const result = runCli(['help'], dir);

  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('Usage: aco <command>'));
  assert.ok(!result.stdout.includes('Usage: wrapper <command>'));
});

test('stale wrapper help invocation fails fast with aco help remediation', () => {
  const dir = makeTempDir();
  writeConfig(dir);
  const staleCliPath = join(dir, 'wrapper');
  symlinkSync(CLI_PATH, staleCliPath);

  const result = spawnSync(process.execPath, [staleCliPath, 'help'], {
    cwd: dir,
    env: process.env,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), 'Use aco help.');
  assert.ok(!result.stdout.includes('Usage: wrapper <command>'));
});

test('stale wrapper setup invocation fails fast with aco setup remediation', () => {
  const dir = makeTempDir();
  writeConfig(dir);
  const staleCliPath = join(dir, 'wrapper');
  symlinkSync(CLI_PATH, staleCliPath);

  const result = spawnSync(process.execPath, [staleCliPath, 'setup'], {
    cwd: dir,
    env: process.env,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), 'Use aco setup.');
});

test('version output reads from package.json and uses aco branding', () => {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const dir = makeTempDir();
  writeConfig(dir);

  const result = runCli(['version'], dir);

  assert.equal(result.status, 0);
  assert.ok(result.stdout.startsWith(`aco v${packageJson.version}`));
  assert.ok(!result.stdout.includes('ai-cli-orch-wrapper'));
});

test('bare invocation exits with aco help remediation instead of undefined unknown-command output', () => {
  const dir = makeTempDir();
  writeConfig(dir);

  const result = runCli([], dir);

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('Use aco help.'));
  assert.ok(!result.stderr.includes("unknown command 'undefined'"));
});

test('ordinary unknown-command output points users to aco help only', () => {
  const dir = makeTempDir();
  writeConfig(dir);

  const result = runCli(['typo-command'], dir);

  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("unknown command 'typo-command'"));
  assert.ok(result.stderr.trim().endsWith('Use aco help.'));
  assert.ok(!result.stderr.includes('wrapper'));
  assert.ok(!result.stderr.includes('ai-cli-orch-wrapper'));
});

test('readme quick-start guidance uses aco and avoids raw node invocation for users', () => {
  const readme = readFileSync(README_PATH, 'utf8');

  assert.ok(readme.includes('aco help'));
  assert.ok(readme.includes('aco version'));
  assert.ok(!readme.includes('node dist/cli.js --help'));
});

test('reserved alias definitions do not block built-ins or appear in help aliases', () => {
  const dir = makeTempDir();
  writeFileSync(join(dir, '.wrapper.json'), JSON.stringify({
    aliases: {
      setup: { provider: 'claude_code', agent: 'developer' },
    },
    roles: {
      orchestrator: 'claude_code',
      reviewer: 'gemini_cli',
    },
  }, null, 2), 'utf8');

  const result = runCli(['help'], dir);

  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('Usage: aco <command>'));
  assert.ok(!result.stdout.includes('  setup    Launch claude_code via cao'));
});
