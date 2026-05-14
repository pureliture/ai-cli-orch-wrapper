import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { delimiter, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolveProviderTimeoutSeconds } from '../src/runtime/provider-execution-control';

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  home: string;
}

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aco-provider-reliability-home-'));
}

async function makeWorkspaceWithPrompt(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'aco-provider-reliability-workspace-'));
  const promptDir = join(workspace, '.claude', 'aco', 'prompts', 'gemini');
  await mkdir(promptDir, { recursive: true });
  await writeFile(join(promptDir, 'review.md'), 'Review this input.\n');
  return workspace;
}

async function makeFakeProviderBin(name: string, body: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'aco-provider-reliability-bin-'));
  const file = join(dir, name);
  await writeFile(file, `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
  return dir;
}

function makeFakeGeminiBody(runtimeBody: string): string {
  return [
    "if (process.argv.includes('--version')) {",
    "  process.stdout.write('gemini-test 0.0.0\\n');",
    '  process.exit(0);',
    '}',
    runtimeBody,
  ].join('\n');
}

async function runCli(
  args: string[],
  options: {
    home?: string;
    cwd?: string;
    timeoutMs?: number;
    pathPrefix?: string;
    env?: Record<string, string>;
  } = {}
): Promise<CliResult> {
  const home = options.home ?? (await makeHome());
  const cliRoot = resolve(__dirname, '..');
  const cliPath = join(cliRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');

  return new Promise((resolveResult) => {
    execFile(
      process.execPath,
      ['--require', tsxRegister, cliPath, ...args],
      {
        cwd: options.cwd ?? cliRoot,
        timeout: options.timeoutMs ?? 5_000,
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          NO_COLOR: '1',
          GEMINI_API_KEY: 'test-key',
          PATH: options.pathPrefix
            ? `${options.pathPrefix}${delimiter}${process.env.PATH ?? ''}`
            : process.env.PATH,
          ...options.env,
        },
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code ?? 1
            : error
            ? 1
            : 0;
        resolveResult({ code, stdout, stderr, home });
      }
    );
  });
}

async function latestSessionId(home: string): Promise<string> {
  const entries = await readdir(join(home, '.aco', 'sessions'));
  assert.equal(entries.length, 1);
  return entries[0];
}

async function latestRunId(home: string): Promise<string> {
  const entries = await readdir(join(home, '.aco', 'runs'));
  assert.equal(entries.length, 1);
  return entries[0];
}

async function waitForSessionWithPid(home: string): Promise<{ id: string; pid: number }> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const root = join(home, '.aco', 'sessions');
    if (existsSync(root)) {
      const ids = await readdir(root);
      for (const id of ids) {
        const task = JSON.parse(await readFile(join(root, id, 'task.json'), 'utf8')) as {
          pid?: unknown;
        };
        if (typeof task.pid === 'number') return { id, pid: task.pid };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for session PID');
}

describe('provider execution timeout resolution', () => {
  it('uses the 300 second default when no flag or env timeout is provided', () => {
    assert.equal(resolveProviderTimeoutSeconds(undefined, {}), 300);
  });

  it('uses ACO_TIMEOUT_SECONDS when no CLI timeout is provided', () => {
    assert.equal(resolveProviderTimeoutSeconds(undefined, { ACO_TIMEOUT_SECONDS: '42' }), 42);
  });

  it('lets --timeout take precedence over ACO_TIMEOUT_SECONDS', () => {
    assert.equal(resolveProviderTimeoutSeconds('7', { ACO_TIMEOUT_SECONDS: '42' }), 7);
  });

  it('rejects non-positive and non-numeric timeout values', () => {
    assert.throws(() => resolveProviderTimeoutSeconds('0', {}), /--timeout/);
    assert.throws(() => resolveProviderTimeoutSeconds('-1', {}), /--timeout/);
    assert.throws(() => resolveProviderTimeoutSeconds('abc', {}), /--timeout/);
  });
});

describe('provider session reliability CLI contract', () => {
  it('rejects invalid timeout values before creating provider sessions', async () => {
    const workspace = await makeWorkspaceWithPrompt();
    const binDir = await makeFakeProviderBin(
      'gemini',
      makeFakeGeminiBody("process.stdout.write('should not run\\n');")
    );

    const runResult = await runCli(['run', 'gemini', 'review', '--timeout', '0'], {
      cwd: workspace,
      pathPrefix: binDir,
    });

    assert.equal(runResult.code, 1);
    assert.match(runResult.stderr, /Invalid --timeout/);
    assert.equal(existsSync(join(runResult.home, '.aco', 'sessions')), false);

    const askResult = await runCli(
      ['ask', '--providers', 'mock', '--task', 'demo', '--yes', '--timeout', 'abc'],
      { cwd: workspace }
    );

    assert.equal(askResult.code, 1);
    assert.match(askResult.stderr, /Invalid --timeout/);
    assert.equal(existsSync(join(askResult.home, '.aco', 'sessions')), false);
  });

  it('marks a slow spawned provider failed and writes timeout artifacts', async () => {
    const workspace = await makeWorkspaceWithPrompt();
    const binDir = await makeFakeProviderBin(
      'gemini',
      makeFakeGeminiBody(
        [
          "process.stdout.write('partial output before timeout\\n');",
          "setTimeout(() => { process.stdout.write('late output\\n'); process.exit(0); }, 3000);",
        ].join('\n')
      )
    );

    const result = await runCli(['run', 'gemini', 'review', '--input', 'demo', '--timeout', '1'], {
      cwd: workspace,
      pathPrefix: binDir,
      timeoutMs: 5_000,
    });

    assert.equal(result.code, 1);
    const sessionId = await latestSessionId(result.home);
    const sessionDir = join(result.home, '.aco', 'sessions', sessionId);
    const task = JSON.parse(await readFile(join(sessionDir, 'task.json'), 'utf8')) as {
      provider: string;
      command: string;
      status: string;
      pid?: unknown;
    };
    const output = await readFile(join(sessionDir, 'output.log'), 'utf8');
    const error = await readFile(join(sessionDir, 'error.log'), 'utf8');

    assert.equal(task.provider, 'gemini');
    assert.equal(task.command, 'review');
    assert.equal(task.status, 'failed');
    assert.equal(typeof task.pid, 'number');
    assert.match(output, /partial output before timeout/);
    assert.doesNotMatch(output, /late output/);
    assert.match(error, /timed out/i);
  });

  it('records ask timeout in the run ledger without invoking live providers', async () => {
    const workspace = await makeWorkspaceWithPrompt();
    const binDir = await makeFakeProviderBin(
      'gemini',
      makeFakeGeminiBody(
        [
          "process.stdout.write('ask partial output before timeout\\n');",
          "setTimeout(() => { process.stdout.write('ask late output\\n'); process.exit(0); }, 3000);",
        ].join('\n')
      )
    );

    const result = await runCli(
      [
        'ask',
        '--providers',
        'gemini',
        '--task',
        'demo',
        '--yes',
        '--output-mode',
        'save-only',
        '--timeout',
        '1',
      ],
      { cwd: workspace, pathPrefix: binDir, timeoutMs: 5_000 }
    );

    assert.equal(result.code, 1);
    const sessionId = await latestSessionId(result.home);
    const runId = await latestRunId(result.home);
    const sessionDir = join(result.home, '.aco', 'sessions', sessionId);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    ) as { sessions: Array<{ id: string; status: string; error?: string }> };
    const task = JSON.parse(await readFile(join(sessionDir, 'task.json'), 'utf8')) as {
      status: string;
      pid?: unknown;
    };
    const error = await readFile(join(sessionDir, 'error.log'), 'utf8');

    assert.equal(task.status, 'failed');
    assert.equal(typeof task.pid, 'number');
    assert.equal(ledger.sessions[0].id, sessionId);
    assert.equal(ledger.sessions[0].status, 'failed');
    assert.match(ledger.sessions[0].error ?? '', /timed out/i);
    assert.match(error, /timed out/i);
  });

  it('cancels a running spawned provider and preserves cancelled status', async () => {
    const home = await makeHome();
    const workspace = await makeWorkspaceWithPrompt();
    const binDir = await makeFakeProviderBin(
      'gemini',
      makeFakeGeminiBody(
        [
          "process.stdout.write('provider started\\n');",
          "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 50));",
          'setInterval(() => {}, 1000);',
        ].join('\n')
      )
    );
    const cliRoot = resolve(__dirname, '..');
    const cliPath = join(cliRoot, 'src', 'cli.ts');
    const tsxRegister = require.resolve('tsx/cjs');
    const env = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      NO_COLOR: '1',
      GEMINI_API_KEY: 'test-key',
      PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
    };

    const running = spawn(
      process.execPath,
      [
        '--require',
        tsxRegister,
        cliPath,
        'run',
        'gemini',
        'review',
        '--input',
        'demo',
        '--timeout',
        '30',
      ],
      {
        cwd: workspace,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    const { id } = await waitForSessionWithPid(home);
    const cancel = await runCli(['cancel', '--session', id], {
      home,
      cwd: workspace,
      pathPrefix: binDir,
    });
    assert.equal(cancel.code, 0);

    const exitCode = await new Promise<number | null>((resolveExit, rejectExit) => {
      const timeout = setTimeout(() => rejectExit(new Error('aco run did not exit')), 3_000);
      running.once('exit', (code) => {
        clearTimeout(timeout);
        resolveExit(code);
      });
    });

    const task = JSON.parse(
      await readFile(join(home, '.aco', 'sessions', id, 'task.json'), 'utf8')
    ) as { status: string; pid?: unknown };
    const error = await readFile(join(home, '.aco', 'sessions', id, 'error.log'), 'utf8');

    assert.equal(exitCode, 1);
    assert.equal(task.status, 'cancelled');
    assert.equal(typeof task.pid, 'number');
    assert.match(error, /cancelled/i);
  });

  it('preserves provider failure artifacts for ask ledgers', async () => {
    const result = await runCli(
      ['ask', '--providers', 'mock', '--task', 'demo', '--yes', '--output-mode', 'save-only'],
      {
        env: { ACO_MOCK_FAIL: '1' },
      }
    );

    assert.equal(result.code, 1);
    const sessionId = await latestSessionId(result.home);
    const runId = await latestRunId(result.home);
    const sessionDir = join(result.home, '.aco', 'sessions', sessionId);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    ) as { sessions: Array<{ id: string; status: string; error?: string }> };

    await stat(join(sessionDir, 'output.log'));
    const error = await readFile(join(sessionDir, 'error.log'), 'utf8');
    assert.equal(ledger.sessions[0].id, sessionId);
    assert.equal(ledger.sessions[0].status, 'failed');
    assert.match(error, /mock provider forced failure/);
  });
});
