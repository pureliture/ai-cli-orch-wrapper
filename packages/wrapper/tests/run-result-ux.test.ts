/**
 * run-result-ux.test.ts
 *
 * 3.1–3.5: run-level result/status UX
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
  home: string;
}

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aco-run-ux-home-'));
}

async function runCli(
  args: string[],
  options: { home?: string; cwd?: string; timeoutMs?: number; env?: Record<string, string> } = {}
): Promise<CliResult> {
  const home = options.home ?? (await makeHome());
  const cliRoot = resolve(__dirname, '..');
  const cwd = options.cwd ?? cliRoot;
  const cliPath = join(cliRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');

  return new Promise((resolveResult) => {
    execFile(
      process.execPath,
      ['--require', tsxRegister, cliPath, ...args],
      {
        cwd,
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          NO_COLOR: '1',
          ...options.env,
        },
        timeout: options.timeoutMs ?? 10000,
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? ((error as { code: number }).code ?? 1)
            : error
              ? 1
              : 0;
        resolveResult({ code, stdout, stderr, home });
      }
    );
  });
}

async function latestRunId(home: string): Promise<string> {
  const runRoot = join(home, '.aco', 'runs');
  const entries = await readdir(runRoot);
  assert.ok(entries.length >= 1, 'expected at least one run directory');
  return entries[0];
}

async function latestSessionId(home: string): Promise<string> {
  const sessionRoot = join(home, '.aco', 'sessions');
  const entries = await readdir(sessionRoot);
  assert.ok(entries.length >= 1, 'expected at least one session directory');
  return entries[0];
}

async function runAskMock(home: string): Promise<CliResult> {
  return runCli(
    [
      'ask',
      '--providers',
      'mock',
      '--task',
      'run ux test task',
      '--input',
      'run ux test input',
      '--yes',
      '--output-mode',
      'save-only',
    ],
    { home }
  );
}

describe('run-level result/status UX (3.1–3.5)', () => {
  // Task 3.1: aco result --run <runId>
  it('result --run <runId> displays run metadata and per-provider session results', async () => {
    const home = await makeHome();
    const askResult = await runAskMock(home);
    assert.equal(askResult.code, 0, `aco ask failed: ${askResult.stderr}`);

    const runId = await latestRunId(home);
    const result = await runCli(['result', '--run', runId], { home });

    assert.equal(result.code, 0, `aco result --run failed: ${result.stderr}`);

    // run metadata
    assert.ok(result.stdout.includes(`Run: ${runId}`), `missing Run: line, got: ${result.stdout}`);
    assert.ok(result.stdout.includes('Started:'), `missing Started: line`);
    assert.ok(result.stdout.includes('Duration:'), `missing Duration: line`);
    assert.ok(result.stdout.includes('Providers:'), `missing Providers: line`);

    // per-provider session fields
    assert.ok(result.stdout.includes('Provider: mock'), `missing Provider: line`);
    assert.ok(result.stdout.includes('Session:'), `missing Session: line`);
    assert.ok(result.stdout.includes('Status:'), `missing Status: line`);
    assert.ok(result.stdout.includes('Result quality:'), `missing Result quality: line`);
    assert.ok(result.stdout.includes('Warnings:'), `missing Warnings: line`);
    assert.ok(result.stdout.includes('Output bytes:'), `missing Output bytes: line`);
    assert.ok(result.stdout.includes('Output:'), `missing Output: line`);
    assert.ok(result.stdout.includes('Brief:'), `missing Brief: line`);
    assert.ok(result.stdout.includes('Summary:'), `missing Summary: section`);
  });

  // Task 3.2: aco status --run <runId>
  it('status --run <runId> displays per-provider status details', async () => {
    const home = await makeHome();
    const askResult = await runAskMock(home);
    assert.equal(askResult.code, 0, `aco ask failed: ${askResult.stderr}`);

    const runId = await latestRunId(home);
    const result = await runCli(['status', '--run', runId], { home });

    assert.equal(result.code, 0, `aco status --run failed: ${result.stderr}`);

    // run metadata
    assert.ok(result.stdout.includes(`Run: ${runId}`), `missing Run: line, got: ${result.stdout}`);
    assert.ok(result.stdout.includes('Started:'), `missing Started: line`);
    assert.ok(result.stdout.includes('Duration:'), `missing Duration: line`);
    assert.ok(result.stdout.includes('Providers:'), `missing Providers: line`);
    assert.ok(result.stdout.includes('Permission class:'), `missing Permission class: line`);
    assert.ok(result.stdout.includes('Env policy:'), `missing Env policy: line`);

    // per-provider fields
    assert.ok(result.stdout.includes('Provider: mock'), `missing Provider: line`);
    assert.ok(result.stdout.includes('Session:'), `missing Session: line`);
    assert.ok(result.stdout.includes('Status:'), `missing Status: line`);
    assert.ok(result.stdout.includes('Usage status:'), `missing Usage status: line`);
    assert.ok(result.stdout.includes('Warning count:'), `missing Warning count: line`);
    assert.ok(result.stdout.includes('Result quality:'), `missing Result quality: line`);
    assert.ok(result.stdout.includes('Output bytes:'), `missing Output bytes: line`);
    assert.ok(result.stdout.includes('Output:'), `missing Output: line`);
    assert.ok(result.stdout.includes('Brief:'), `missing Brief: line`);
  });

  // Task 3.3: --run latest shorthand
  it('result --run latest resolves most recent run', async () => {
    const home = await makeHome();
    const askResult = await runAskMock(home);
    assert.equal(askResult.code, 0, `aco ask failed: ${askResult.stderr}`);

    const runId = await latestRunId(home);
    const result = await runCli(['result', '--run', 'latest'], { home });

    assert.equal(result.code, 0, `aco result --run latest failed: ${result.stderr}`);
    assert.ok(result.stdout.includes(`Run: ${runId}`), `expected Run: ${runId} in output, got: ${result.stdout}`);
  });

  it('status --run latest resolves most recent run', async () => {
    const home = await makeHome();
    const askResult = await runAskMock(home);
    assert.equal(askResult.code, 0, `aco ask failed: ${askResult.stderr}`);

    const runId = await latestRunId(home);
    const result = await runCli(['status', '--run', 'latest'], { home });

    assert.equal(result.code, 0, `aco status --run latest failed: ${result.stderr}`);
    assert.ok(result.stdout.includes(`Run: ${runId}`), `expected Run: ${runId} in output, got: ${result.stdout}`);
  });

  it('result --run latest exits 1 when no runs exist', async () => {
    const home = await makeHome();
    const result = await runCli(['result', '--run', 'latest'], { home });

    assert.equal(result.code, 1, `expected exit 1, got: ${result.code}`);
    assert.ok(
      result.stderr.includes('No runs found') || result.stderr.includes('no runs'),
      `expected clear error message, got: ${result.stderr}`
    );
  });

  // Task 3.4: existing --session behavior regression test
  it('result --session <id> still works (regression)', async () => {
    const home = await makeHome();
    const askResult = await runAskMock(home);
    assert.equal(askResult.code, 0, `aco ask failed: ${askResult.stderr}`);

    const sessionId = await latestSessionId(home);
    const result = await runCli(['result', '--session', sessionId], { home });

    assert.equal(result.code, 0, `aco result --session failed: ${result.stderr}`);
    // should output the session's log content, not run metadata
    assert.ok(!result.stdout.includes('Run:'), `--session should not show run metadata`);
  });

  it('status --session <id> still works (regression)', async () => {
    const home = await makeHome();
    const askResult = await runAskMock(home);
    assert.equal(askResult.code, 0, `aco ask failed: ${askResult.stderr}`);

    const sessionId = await latestSessionId(home);
    const result = await runCli(['status', '--session', sessionId], { home });

    assert.equal(result.code, 0, `aco status --session failed: ${result.stderr}`);
    // old session-level status format
    assert.ok(result.stdout.includes('Session:'), `missing Session: line`);
    assert.ok(result.stdout.includes('Provider:'), `missing Provider: line`);
    assert.ok(!result.stdout.includes('Run:'), `--session should not show run metadata`);
  });

  // Task 3.5: aco result --run <invalid-id> error path
  it('result --run <nonexistent-id> exits 1 with clear error message', async () => {
    const home = await makeHome();
    const result = await runCli(['result', '--run', 'nonexistent-run-id-xyz'], { home });

    assert.equal(result.code, 1, `expected exit 1, got: ${result.code}`);
    assert.ok(
      result.stderr.includes('nonexistent-run-id-xyz') ||
        result.stderr.includes('not found') ||
        result.stderr.includes('No run'),
      `expected clear error message mentioning the run id, got: ${result.stderr}`
    );
  });

  it('status --run <nonexistent-id> exits 1 with clear error message', async () => {
    const home = await makeHome();
    const result = await runCli(['status', '--run', 'nonexistent-run-id-xyz'], { home });

    assert.equal(result.code, 1, `expected exit 1, got: ${result.code}`);
    assert.ok(
      result.stderr.includes('nonexistent-run-id-xyz') ||
        result.stderr.includes('not found') ||
        result.stderr.includes('No run'),
      `expected clear error message mentioning the run id, got: ${result.stderr}`
    );
  });
});
