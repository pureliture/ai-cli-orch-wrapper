import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { invokeProviderForSession } from '../src/runtime/provider-session-runner';
import { MockProvider } from '../src/providers/mock';
import type { IProvider } from '../src/providers/interface';

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
    assert.doesNotMatch(result.stdout, /Findings:/);

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

    await stat(join(sessionDir, 'prompt.md'));
    await stat(join(sessionDir, 'brief.md'));

    const runId = await latestRunId(result.home);
    const runDir = join(result.home, '.aco', 'runs', runId);
    // input.md is now stored at run level (Task 4.1: canonical run-level input)
    await stat(join(runDir, 'input.md'));
    const ledger = JSON.parse(await readFile(join(runDir, 'ledger.json'), 'utf8'));
    assert.equal(ledger.runId, runId);
    assert.deepEqual(ledger.providers, ['mock']);
    assert.equal(ledger.permissionProfile, 'restricted');
    assert.equal(ledger.outputMode, 'brief');
    assert.equal(ledger.sessions[0].id, sessionId);
    await stat(join(runDir, 'brief.md'));
  });

  it('renders the aco Runtime Session dashboard to stderr (shared kernel)', async () => {
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
    // 롤업 대시보드는 stderr에 1회 렌더되어 stdout brief를 손상시키지 않는다.
    assert.match(result.stderr, /aco Runtime Session/);
    // 롤업 헤더는 1회만 렌더된다(provider 루프마다 반복 렌더하지 않음).
    assert.equal(result.stderr.match(/aco Runtime Session/g)?.length, 1);
    // 롤업 헤더(공통)와 provider 행(session)이 stderr에 나타난다.
    assert.match(result.stderr, /Rollup/);
    assert.match(result.stderr, /Session ID/);
    // NO_COLOR=1 환경에서도 provider 아이콘은 유지된다(별도 --no-unicode 미설정).
    assert.match(result.stderr, /⚪ mock/);
    assert.doesNotMatch(result.stdout, /aco Runtime Session/);
    // stdout brief는 그대로 유지된다.
    assert.match(result.stdout, /Run:/);
  });

  it('preserves raw inline input including leading spaces and trailing newline', async () => {
    const rawInput = '  leading spaces stay\ntrailing newline stays\n';

    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'preserve raw inline input',
      '--input',
      rawInput,
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0);
    // input.md is now stored at run level (Task 4.1: canonical run-level input)
    const runId = await latestRunId(result.home);
    const savedInput = await readFile(
      join(result.home, '.aco', 'runs', runId, 'input.md'),
      'utf8'
    );

    assert.equal(savedInput, rawInput);
  });

  it('preserves raw input-file content exactly', async () => {
    const home = await makeHome();
    const workspace = await mkdtemp(join(tmpdir(), 'aco-ask-workspace-'));
    const rawFileInput = '  file leading spaces stay\nfile trailing newline stays\n';
    await writeFile(join(workspace, 'raw-input.md'), rawFileInput);

    const result = await runCli(
      [
        'ask',
        '--providers',
        'mock',
        '--task',
        'preserve raw file input',
        '--input-file',
        'raw-input.md',
        '--yes',
        '--output-mode',
        'save-only',
      ],
      { home, cwd: workspace }
    );

    assert.equal(result.code, 0);
    // input.md is now stored at run level (Task 4.1: canonical run-level input)
    const runId = await latestRunId(home);
    const savedInput = await readFile(
      join(home, '.aco', 'runs', runId, 'input.md'),
      'utf8'
    );

    assert.equal(savedInput, rawFileInput);
  });

  it('combines inline and file input with a deterministic raw-preserving separator', async () => {
    const home = await makeHome();
    const workspace = await mkdtemp(join(tmpdir(), 'aco-ask-workspace-'));
    const inlineInput = ' inline block ends with newline\n';
    const fileInput = '\nfile block starts with newline\n';
    await writeFile(join(workspace, 'combined-input.md'), fileInput);

    const result = await runCli(
      [
        'ask',
        '--providers',
        'mock',
        '--task',
        'preserve combined raw input',
        '--input',
        inlineInput,
        '--input-file',
        'combined-input.md',
        '--yes',
        '--output-mode',
        'save-only',
      ],
      { home, cwd: workspace }
    );

    assert.equal(result.code, 0);
    // input.md is now stored at run level (Task 4.1: canonical run-level input)
    const runId = await latestRunId(home);
    const savedInput = await readFile(
      join(home, '.aco', 'runs', runId, 'input.md'),
      'utf8'
    );

    assert.equal(savedInput, `${inlineInput}\n\n${fileInput}`);
  });

  it('prints a bounded provider summary in brief mode without dumping the full body', async () => {
    const hiddenTail = 'UNIQUE_AFTER_BOUND_SHOULD_NOT_APPEAR_IN_BRIEF';
    const largeInput = `${'x'.repeat(1400)}${hiddenTail}`;

    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'summarize this long provider output',
      '--input',
      largeInput,
      '--yes',
      '--output-mode',
      'brief',
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Summary:/);
    assert.match(result.stdout, /Provider: mock/);
    assert.match(result.stdout, /\.\.\.\[truncated to 600 chars\]/);
    assert.doesNotMatch(result.stdout, new RegExp(hiddenTail));
    assert.doesNotMatch(result.stdout, /Findings:/);

    const sessionId = await latestSessionId(result.home);
    const sessionBrief = await readFile(
      join(result.home, '.aco', 'sessions', sessionId, 'brief.md'),
      'utf8'
    );
    const runId = await latestRunId(result.home);
    const runBrief = await readFile(join(result.home, '.aco', 'runs', runId, 'brief.md'), 'utf8');
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    );

    assert.match(sessionBrief, /Summary:/);
    assert.match(runBrief, /Summary:/);
    assert.match(sessionBrief, /\.\.\.\[truncated to 600 chars\]/);
    assert.match(runBrief, /\.\.\.\[truncated to 600 chars\]/);
    assert.equal(typeof ledger.sessions[0].summary, 'string');
    assert.match(ledger.sessions[0].summary, /\.\.\.\[truncated to 600 chars\]/);
    assert.doesNotMatch(ledger.sessions[0].summary, new RegExp(hiddenTail));
  });

  it('does not truncate brief summaries at Findings headings inside raw input', async () => {
    const inputWithHeading = 'alpha\nFindings:\nomega\n';

    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'summarize input containing a findings heading',
      '--input',
      inputWithHeading,
      '--yes',
      '--output-mode',
      'brief',
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /alpha/);
    assert.match(result.stdout, /omega/);
    assert.doesNotMatch(result.stdout, /Treat this mock output as deterministic test data/);

    const runId = await latestRunId(result.home);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    );
    assert.match(ledger.sessions[0].summary, /alpha/);
    assert.match(ledger.sessions[0].summary, /omega/);
    assert.doesNotMatch(
      ledger.sessions[0].summary,
      /Treat this mock output as deterministic test data/
    );
  });

  it('keeps raw input after Findings headings when the provider footer is beyond the summary source prefix', async () => {
    const inputWithHeading = `alpha\nFindings:\nomega\n${'tail '.repeat(4000)}`;
    assert.ok(inputWithHeading.length > 16 * 1024);

    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'x',
      '--input',
      inputWithHeading,
      '--yes',
      '--output-mode',
      'brief',
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /alpha/);
    assert.match(result.stdout, /omega/);
    assert.doesNotMatch(result.stdout, /Treat this mock output as deterministic test data/);

    const runId = await latestRunId(result.home);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    );
    assert.match(ledger.sessions[0].summary, /alpha/);
    assert.match(ledger.sessions[0].summary, /omega/);
    assert.doesNotMatch(
      ledger.sessions[0].summary,
      /Treat this mock output as deterministic test data/
    );
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
    assert.doesNotMatch(saveOnly.stdout, /Summary:/);
    assert.doesNotMatch(saveOnly.stdout, /Findings:/);
    const saveOnlyRunId = await latestRunId(saveOnly.home);
    const saveOnlyLedger = JSON.parse(
      await readFile(join(saveOnly.home, '.aco', 'runs', saveOnlyRunId, 'ledger.json'), 'utf8')
    );
    assert.match(saveOnlyLedger.sessions[0].summary, /Provider: mock/);
    assert.doesNotMatch(saveOnlyLedger.sessions[0].summary, /\(no provider output\)/);

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
    const fullRunId = await latestRunId(full.home);
    const fullLedger = JSON.parse(
      await readFile(join(full.home, '.aco', 'runs', fullRunId, 'ledger.json'), 'utf8')
    );
    assert.match(fullLedger.sessions[0].summary, /Provider: mock/);
    assert.doesNotMatch(fullLedger.sessions[0].summary, /\(no provider output\)/);
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
    // input.md is now stored at run level (Task 4.1: canonical run-level input)
    const runId = await latestRunId(home);
    const runDir = join(home, '.aco', 'runs', runId);

    const prompt = await readFile(join(sessionDir, 'prompt.md'), 'utf8');
    const input = await readFile(join(runDir, 'input.md'), 'utf8');
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
    await stat(join(sessionDir, 'error.log'));

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

  it('captures bounded fullOutput for summaries when maxOutputBuffer is set', async () => {
    const provider = new MockProvider();
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const runResult = await invokeProviderForSession({
      provider,
      command: 'ask',
      prompt: 'test',
      content: 'x'.repeat(2000),
      permissionProfile: 'restricted',
      sessionId: 'test-session-cap',
      output,
      maxOutputBuffer: 600,
    });

    assert.ok(runResult.hasOutput);
    assert.equal(runResult.fullOutput.length, 600);
  });

  it('caps fullOutput in runResult when bounded output buffering is set', async () => {
    const provider = new MockProvider();
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const runResult = await invokeProviderForSession({
      provider,
      command: 'ask',
      prompt: 'test',
      content: 'x'.repeat(2000),
      permissionProfile: 'restricted',
      sessionId: 'test-session-cap',
      output,
      outputBuffer: { mode: 'bounded' },
      maxOutputBuffer: 600,
    });

    assert.ok(runResult.hasOutput);
    assert.equal(runResult.fullOutput.length, 600);
  });

  // F-c: --model + antigravity 경고 테스트
  it('warns on stderr when --model is used with antigravity provider', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'antigravity',
      '--task',
      'review this',
      '--model',
      'gemini-3.1-pro',
      '--dry-run',
    ]);

    // dry-run이므로 exit code 0, stderr에 경고가 있어야 함
    assert.equal(result.code, 0);
    assert.match(result.stderr, /\[aco\] warning: antigravity\(agy\) ignores --model/);
    assert.match(result.stderr, /--model applies to codex only/);
  });

  it('does NOT warn when --model is used with codex provider', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'codex',
      '--task',
      'review this',
      '--model',
      'gpt-5.4',
      '--dry-run',
    ]);

    assert.equal(result.code, 0);
    assert.doesNotMatch(result.stderr, /antigravity\(agy\) ignores --model/);
  });

  it('does NOT warn when antigravity is used without --model', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'antigravity',
      '--task',
      'review this',
      '--dry-run',
    ]);

    assert.equal(result.code, 0);
    assert.doesNotMatch(result.stderr, /antigravity\(agy\) ignores --model/);
  });

  it('credential note message says "will NOT inherit" not "will be inherited"', async () => {
    // OPENAI_API_KEY는 findCredentialEnvKeys가 탐지하는 키다.
    // envPolicy allowlist 도입 이후 child에게 전달되지 않으므로,
    // 메시지는 "inherited"가 아니라 "will NOT inherit"를 포함해야 한다.
    const result = await runCli(
      [
        'ask',
        '--providers',
        'mock',
        '--task',
        'test credential note',
        '--yes',
        '--output-mode',
        'save-only',
      ],
      { env: { OPENAI_API_KEY: 'sk-test-fake-key-for-warning-test' } }
    );

    assert.equal(result.code, 0);
    assert.match(result.stderr, /will NOT inherit/);
    assert.doesNotMatch(result.stderr, /will be inherited/);
  });

  it('waits for writable drain even when the sink exposes compatibility flags', async () => {
    let drainCount = 0;
    let sawDrainBeforeSecondChunk = false;
    const output = new Writable({
      highWaterMark: 1,
      write(_chunk, _encoding, callback) {
        setTimeout(callback, 25);
      },
    }) as Writable & { skipDrainWait?: boolean };
    output.skipDrainWait = true;
    output.on('drain', () => {
      drainCount += 1;
    });

    const provider: IProvider = {
      key: 'slow-test',
      installHint: 'test provider',
      icon: '⚪',
      isAvailable: () => true,
      checkAuth: async () => ({
        ok: true,
        method: 'cli-fallback',
        version: 'test',
        binaryPath: 'test',
      }),
      buildArgs: () => ['slow-test'],
      async *invoke() {
        yield 'first chunk';
        sawDrainBeforeSecondChunk = drainCount > 0;
        yield 'second chunk';
      },
    };

    const runResult = await invokeProviderForSession({
      provider,
      command: 'ask',
      prompt: 'test',
      content: 'test',
      permissionProfile: 'restricted',
      sessionId: 'test-session-drain',
      output,
    });

    assert.ok(runResult.hasOutput);
    assert.equal(sawDrainBeforeSecondChunk, true);
  });
});
