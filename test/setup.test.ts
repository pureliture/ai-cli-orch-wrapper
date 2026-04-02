/**
 * Setup command tests
 *
 * Tests for setupCommand() covering SETUP-01 through SETUP-04.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const originalHome = process.env.HOME;

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), 'wrapper-test-'));
}

function restoreHome(): void {
  process.env.HOME = originalHome;
}

// Test 1: ai-cli.conf is created with correct header content
test('ai-cli.conf is created with correct header content', async () => {
  const tempHome = makeTempHome();
  process.env.HOME = tempHome;
  try {
    // Import after setting HOME so homedir() picks up the override in the module
    // We re-import fresh by using dynamic import with the built dist artifact
    const { setupCommand } = await import('../dist/commands/setup.js');
    await setupCommand();

    const confPath = join(tempHome, '.config', 'tmux', 'ai-cli.conf');
    assert.ok(existsSync(confPath), 'ai-cli.conf should exist');

    const content = readFileSync(confPath, 'utf8');
    assert.ok(content.includes('# aco tmux config'), 'should include title comment');
    assert.ok(content.includes('# Managed by aco setup'), 'should include managed-by comment');
    assert.ok(content.includes('# CLI alias bindings are managed via .wrapper.json in the project root.'), 'should include wrapper.json reference comment');
  } finally {
    restoreHome();
  }
});

// Test 2: ~/.tmux.conf source-file line injected on first run
test('~/.tmux.conf source-file line injected on first run', async () => {
  const tempHome = makeTempHome();
  process.env.HOME = tempHome;
  try {
    const { setupCommand } = await import('../dist/commands/setup.js');
    await setupCommand();

    const tmuxConf = join(tempHome, '.tmux.conf');
    assert.ok(existsSync(tmuxConf), '.tmux.conf should exist');

    const content = readFileSync(tmuxConf, 'utf8');
    assert.ok(content.includes('source-file'), 'should include source-file directive');
    assert.ok(
      content.includes(join(tempHome, '.config', 'tmux', 'ai-cli.conf')),
      'source-file line should reference the ai-cli.conf path',
    );
  } finally {
    restoreHome();
  }
});

// Test 3: idempotency — second run does not duplicate source-file line
test('idempotency — second run does not duplicate source-file line', async () => {
  const tempHome = makeTempHome();
  process.env.HOME = tempHome;
  try {
    const { setupCommand } = await import('../dist/commands/setup.js');
    await setupCommand();
    await setupCommand();

    const tmuxConf = join(tempHome, '.tmux.conf');
    const content = readFileSync(tmuxConf, 'utf8');

    // Count occurrences of 'source-file' in the file
    const matches = content.match(/source-file/g);
    const count = matches ? matches.length : 0;
    assert.equal(count, 1, 'source-file should appear exactly once after two runs');
  } finally {
    restoreHome();
  }
});

// Test 4: idempotency — second run reports already exists / already configured
test('idempotency — second run reports already exists / already configured', async () => {
  const tempHome = makeTempHome();
  process.env.HOME = tempHome;

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };

  try {
    const { setupCommand } = await import('../dist/commands/setup.js');
    await setupCommand(); // first run
    logs.length = 0; // reset collected logs
    await setupCommand(); // second run

    const output = logs.join('\n');
    assert.ok(output.includes('already exists'), 'second run should report already exists for ai-cli.conf');
    assert.ok(output.includes('already configured'), 'second run should report already configured for .tmux.conf');
  } finally {
    console.log = originalLog;
    restoreHome();
  }
});

// Test 5: missing prerequisites exit 1 with the current tool list
test('missing prerequisite exits 1 with correct message', () => {
  // Spawn a child process with PATH cleared so prerequisite discovery fails.
  const result = spawnSync(
    process.execPath,
    ['dist/cli.js', 'setup'],
    {
      cwd: join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..'),
      env: { ...process.env, PATH: '' },
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 1, 'process should exit with code 1');
  assert.ok(result.stderr.includes('Error: missing prerequisites:'), 'stderr should include error message');
  assert.ok(result.stderr.includes('tmux'), 'stderr should name the missing tool');
  assert.ok(result.stderr.includes('workmux'), 'stderr should name the missing tool');
});
