import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
  home: string;
}

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aco-ask-home-'));
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
        timeout: options.timeoutMs ?? 5000,
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

function cliInvocation(cwd?: string): { cliRoot: string; cliPath: string; tsxRegister: string } {
  const cliRoot = resolve(__dirname, '..');
  return {
    cliRoot: cwd ?? cliRoot,
    cliPath: join(cliRoot, 'src', 'cli.ts'),
    tsxRegister: require.resolve('tsx/cjs'),
  };
}

async function waitForSession(home: string): Promise<string> {
  const sessionRoot = join(home, '.aco', 'sessions');
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (existsSync(sessionRoot)) {
      const entries = await readdir(sessionRoot);
      if (entries.length > 0) return entries[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for session');
}

async function latestSessionId(home: string): Promise<string> {
  const sessionRoot = join(home, '.aco', 'sessions');
  const entries = await readdir(sessionRoot);
  assert.equal(entries.length, 1);
  return entries[0];
}

async function latestRunId(home: string): Promise<string> {
  const runRoot = join(home, '.aco', 'runs');
  const entries = await readdir(runRoot);
  assert.equal(entries.length, 1);
  return entries[0];
}

describe('aco ask CLI', () => {
  it('prints a dry-run plan without creating sessions', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'review this demo input',
      '--input',
      'demo',
      '--dry-run',
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Dry run/);
    assert.match(result.stdout, /Providers: mock/);
    assert.match(result.stdout, /Permission profile: restricted/);
    assert.match(result.stdout, /Output mode: brief/);
    assert.equal(existsSync(join(result.home, '.aco', 'sessions')), false);
  });

  it('defaults to mock to keep MVP ask/result single-session without credentials', async () => {
    const result = await runCli(['ask', '--task', 'review this demo input', '--dry-run']);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Providers: mock/);
  });

  it('does not wait for stdin when no explicit input is provided', async () => {
    const result = await runCli(
      ['ask', '--providers', 'mock', '--task', 'review this demo input', '--dry-run'],
      { timeoutMs: 1000 }
    );

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Input bytes: 0/);
  });

  it('requires explicit consent before provider execution', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'review this demo input',
      '--input',
      'demo',
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stdout + result.stderr, /Consent required/);
    assert.match(result.stdout + result.stderr, /--yes/);
    assert.match(result.stdout + result.stderr, /--dry-run/);
    assert.equal(existsSync(join(result.home, '.aco', 'sessions')), false);
  });

  it('runs mock provider with brief output and saves full artifacts', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'review this demo input',
      '--input',
      'demo',
      '--yes',
      '--output-mode',
      'brief',
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Run:/);
    assert.match(result.stdout, /Session:/);
    assert.match(result.stdout, /Full output saved/);
    assert.match(result.stdout, /Findings:/);

    const sessionId = await latestSessionId(result.home);
    const sessionDir = join(result.home, '.aco', 'sessions', sessionId);
    const task = JSON.parse(await readFile(join(sessionDir, 'task.json'), 'utf8'));
    assert.equal(task.provider, 'mock');
    assert.equal(task.command, 'ask');
    assert.equal(task.permissionProfile, 'restricted');
    assert.equal(task.status, 'done');

    const output = await readFile(join(sessionDir, 'output.log'), 'utf8');
    assert.match(output, /Findings:/);
    assert.match(output, /demo/);

    await stat(join(sessionDir, 'input.md'));
    await stat(join(sessionDir, 'prompt.md'));
    await stat(join(sessionDir, 'brief.md'));

    const runId = await latestRunId(result.home);
    const runDir = join(result.home, '.aco', 'runs', runId);
    const ledger = JSON.parse(await readFile(join(runDir, 'ledger.json'), 'utf8'));
    assert.equal(ledger.runId, runId);
    assert.deepEqual(ledger.providers, ['mock']);
    assert.equal(ledger.permissionProfile, 'restricted');
    assert.equal(ledger.outputMode, 'brief');
    assert.equal(ledger.sessions[0].id, sessionId);
    await stat(join(runDir, 'brief.md'));
  });

  it('supports save-only and full output modes explicitly', async () => {
    const saveOnly = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'review this demo input',
      '--input',
      'demo',
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(saveOnly.code, 0);
    assert.match(saveOnly.stdout, /saved/);
    assert.doesNotMatch(saveOnly.stdout, /Brief/);
    assert.doesNotMatch(saveOnly.stdout, /Findings:/);

    const full = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'review this demo input',
      '--input',
      'demo',
      '--yes',
      '--output-mode',
      'full',
    ]);

    assert.equal(full.code, 0);
    assert.match(full.stdout, /Provider: mock/);
    assert.match(full.stdout, /Findings:/);
  });

  it('loads presets and input files into saved artifacts', async () => {
    const home = await makeHome();
    const workspace = await mkdtemp(join(tmpdir(), 'aco-ask-workspace-'));
    const presetDir = join(workspace, '.claude', 'aco', 'tasks');
    await mkdir(presetDir, { recursive: true });
    await writeFile(join(presetDir, 'review.md'), 'Preset: review from workspace\n');
    await writeFile(join(workspace, 'input.md'), 'file demo\n');

    const result = await runCli(
      [
        'ask',
        '--providers',
        'mock',
        '--preset',
        'review',
        '--task',
        'review this demo input',
        '--input',
        'inline demo',
        '--input-file',
        'input.md',
        '--yes',
      ],
      { home, cwd: workspace }
    );

    assert.equal(result.code, 0);
    const sessionId = await latestSessionId(home);
    const sessionDir = join(home, '.aco', 'sessions', sessionId);

    const prompt = await readFile(join(sessionDir, 'prompt.md'), 'utf8');
    const input = await readFile(join(sessionDir, 'input.md'), 'utf8');
    assert.match(prompt, /Preset: review from workspace/);
    assert.match(prompt, /Never modify files/);
    assert.match(input, /inline demo/);
    assert.match(input, /file demo/);
  });

  it('saves partial output on provider failure so aco result can inspect it', async () => {
    const failed = await runCli(
      [
        'ask',
        '--providers',
        'mock',
        '--task',
        'review this demo input',
        '--input',
        'demo',
        '--yes',
        '--output-mode',
        'save-only',
      ],
      { env: { ACO_MOCK_FAIL: '1' } }
    );

    assert.equal(failed.code, 1);
    const sessionId = await latestSessionId(failed.home);
    const sessionDir = join(failed.home, '.aco', 'sessions', sessionId);
    const output = await readFile(join(sessionDir, 'output.log'), 'utf8');
    const task = JSON.parse(await readFile(join(sessionDir, 'task.json'), 'utf8'));

    assert.equal(task.status, 'failed');
    assert.match(output, /Provider: mock/);

    const result = await runCli(['result', '--session', sessionId], { home: failed.home });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Provider: mock/);
  });

  it('preserves cancelled status if a running ask session is cancelled', async () => {
    const home = await makeHome();
    const { cliRoot, cliPath, tsxRegister } = cliInvocation();
    const child = spawn(
      process.execPath,
      [
        '--require',
        tsxRegister,
        cliPath,
        'ask',
        '--providers',
        'mock',
        '--task',
        'review this demo input',
        '--input',
        'demo',
        '--yes',
        '--output-mode',
        'save-only',
      ],
      {
        cwd: cliRoot,
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          NO_COLOR: '1',
          ACO_MOCK_DELAY_MS: '500',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    const sessionId = await waitForSession(home);
    const cancelled = await runCli(['cancel', '--session', sessionId], { home });
    assert.equal(cancelled.code, 0);

    const exitCode = await new Promise<number | null>((resolveExit) => {
      child.on('close', resolveExit);
    });
    assert.equal(exitCode, 1);

    const sessionDir = join(home, '.aco', 'sessions', sessionId);
    const task = JSON.parse(await readFile(join(sessionDir, 'task.json'), 'utf8'));
    assert.equal(task.status, 'cancelled');
    await stat(join(sessionDir, 'output.log'));
  });

  it('rejects invalid permission profiles, output modes, providers, and preset names', async () => {
    const badPermission = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'review this demo input',
      '--permission-profile',
      'dangerous',
      '--dry-run',
    ]);
    assert.equal(badPermission.code, 1);
    assert.match(badPermission.stderr, /Invalid --permission-profile/);

    const badOutput = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'review this demo input',
      '--output-mode',
      'everything',
      '--dry-run',
    ]);
    assert.equal(badOutput.code, 1);
    assert.match(badOutput.stderr, /Invalid --output-mode/);

    const badProviders = await runCli([
      'ask',
      '--providers',
      ',',
      '--task',
      'review this demo input',
      '--dry-run',
    ]);
    assert.equal(badProviders.code, 1);
    assert.match(badProviders.stderr, /--providers must include at least one provider/);

    const badPreset = await runCli([
      'ask',
      '--providers',
      'mock',
      '--preset',
      '../../../docs/guides/runbook',
      '--dry-run',
    ]);
    assert.equal(badPreset.code, 1);
    assert.match(badPreset.stderr, /Invalid --preset/);
  });
});
