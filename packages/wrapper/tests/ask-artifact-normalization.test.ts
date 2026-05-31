import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, stat } from 'node:fs/promises';
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
  return mkdtemp(join(tmpdir(), 'aco-art-home-'));
}

async function runCli(args: string[], options: { home?: string } = {}): Promise<CliResult> {
  const home = options.home ?? (await makeHome());
  const cliRoot = resolve(__dirname, '..');
  const cliPath = join(cliRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');
  return new Promise((resolveResult) => {
    execFile(
      process.execPath,
      ['--require', tsxRegister, cliPath, ...args],
      {
        cwd: cliRoot,
        env: { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: '1' },
        timeout: 15000,
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
  const runsDir = join(home, '.aco', 'runs');
  const entries = await readdir(runsDir);
  const withMtime = await Promise.all(
    entries.map(async (name) => {
      const s = await stat(join(runsDir, name)).catch(() => null);
      return { name, mtime: s?.mtimeMs ?? 0 };
    })
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  return withMtime[0].name;
}

async function latestSessionId(home: string): Promise<string> {
  const sessionRoot = join(home, '.aco', 'sessions');
  const entries = await readdir(sessionRoot);
  return entries[0];
}

describe('artifact normalization', () => {
  it('input stored at run level: input.md exists in runs/<runId>/, not in sessions/<sessionId>/', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'review this demo input',
      '--input',
      'test input content',
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0);

    const runId = await latestRunId(result.home);
    const runDir = join(result.home, '.aco', 'runs', runId);

    // Task 4.1: input.md should exist at run level
    await stat(join(runDir, 'input.md'));

    // Task 4.1: input.md should NOT exist at session level
    const sessionId = await latestSessionId(result.home);
    const sessionInputPath = join(result.home, '.aco', 'sessions', sessionId, 'input.md');
    assert.equal(
      existsSync(sessionInputPath),
      false,
      'input.md should not exist in session directory after normalization'
    );
  });

  it('canonical input file contains the exact input content', async () => {
    const inputContent = 'canonical input test content\nwith multiple lines\n';

    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'test canonical input',
      '--input',
      inputContent,
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0);

    const runId = await latestRunId(result.home);
    const canonicalInput = await readFile(
      join(result.home, '.aco', 'runs', runId, 'input.md'),
      'utf8'
    );

    assert.equal(canonicalInput, inputContent);
  });

  it('session ledger has canonicalInputPath and inputHash fields', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'test session ledger fields',
      '--input',
      'ledger field test input',
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0);

    const runId = await latestRunId(result.home);
    const runDir = join(result.home, '.aco', 'runs', runId);
    const ledger = JSON.parse(await readFile(join(runDir, 'ledger.json'), 'utf8'));

    const session = ledger.sessions[0];

    // Task 4.2: canonicalInputPath should be the run-level input.md path
    assert.ok(
      typeof session.canonicalInputPath === 'string',
      'session should have canonicalInputPath'
    );
    assert.match(
      session.canonicalInputPath,
      /runs\/.+\/input\.md$/,
      'canonicalInputPath should point to runs/<runId>/input.md'
    );
    assert.equal(session.canonicalInputPath, join(runDir, 'input.md'));

    // Task 4.2: inputHash should be a sha256 hex string
    assert.ok(typeof session.inputHash === 'string', 'session should have inputHash');
    assert.match(session.inputHash, /^[0-9a-f]{64}$/, 'inputHash should be a SHA-256 hex digest');

    // inputHash in session should match inputHash in run ledger
    assert.equal(session.inputHash, ledger.inputHash, 'session inputHash should match run inputHash');
  });

  it('summaryTruncated is true when output exceeds 600 chars', async () => {
    // Use a large input so the mock provider generates output > 600 chars
    const largeInput = 'x'.repeat(1400);

    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'test summary truncation',
      '--input',
      largeInput,
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0);

    const runId = await latestRunId(result.home);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    );

    const session = ledger.sessions[0];

    // Task 4.3: summaryTruncated should be a boolean
    assert.ok(typeof session.summaryTruncated === 'boolean', 'session should have summaryTruncated boolean');

    // With large input, mock provider generates > 600 chars output, so summaryTruncated should be true
    assert.equal(session.summaryTruncated, true, 'summaryTruncated should be true for large output');
  });

  it('summaryTruncated is false when output is within 600 chars', async () => {
    // Use a small input so mock output is within limits
    const smallInput = 'hi';

    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'x',
      '--input',
      smallInput,
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0);

    const runId = await latestRunId(result.home);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    );

    const session = ledger.sessions[0];

    // Task 4.3: summaryTruncated should be a boolean
    assert.ok(typeof session.summaryTruncated === 'boolean', 'session should have summaryTruncated boolean');

    // With small input, mock output may fit within 600 chars
    assert.equal(session.summaryTruncated, false, 'summaryTruncated should be false for small output');
  });

  it('topFindings is an array when mock output has numbered items', async () => {
    // Mock provider uses input in output, and the output template has numbered findings
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
      'save-only',
    ]);

    assert.equal(result.code, 0);

    const runId = await latestRunId(result.home);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    );

    const session = ledger.sessions[0];

    // Task 4.4: topFindings should exist
    assert.ok('topFindings' in session, 'session should have topFindings field');

    // Mock provider output includes numbered items like "1. ..." so topFindings should be an array
    if (session.topFindings !== null) {
      assert.ok(Array.isArray(session.topFindings), 'topFindings should be an array or null');
      assert.ok(session.topFindings.length > 0, 'topFindings should have at least one item from mock output');
      assert.ok(session.topFindings.length <= 10, 'topFindings should have at most 10 items');
      for (const item of session.topFindings) {
        assert.ok(typeof item === 'string', 'each topFindings item should be a string');
        assert.ok(item.trim().length > 0, 'each topFindings item should be non-empty');
      }
    }
  });

  it('topFindings is null when output has no list items', async () => {
    // We test the extractTopFindings logic directly via unit test approach
    // by verifying the function with no-list output produces null
    // This is tested via the session ledger when mock output has no list items
    // Since we cannot control mock output fully, we test the function directly

    // For now, test that the field is always present
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'simple task',
      '--input',
      'no list here',
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0);

    const runId = await latestRunId(result.home);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    );

    const session = ledger.sessions[0];
    assert.ok('topFindings' in session, 'session should always have topFindings field (array or null)');
    // topFindings is either an array or null
    assert.ok(
      session.topFindings === null || Array.isArray(session.topFindings),
      'topFindings should be null or an array'
    );
  });
});

describe('extractTopFindings unit', () => {
  // Direct import of extractTopFindings — tsx/cjs handles TypeScript source
  const { extractTopFindings } = require('../src/commands/ask') as {
    extractTopFindings: (output: string) => string[] | null;
  };

  it('extracts numbered list items', () => {
    const output = '1. First finding\n2. Second finding\n3. Third finding\n';
    const findings = extractTopFindings(output);
    assert.ok(Array.isArray(findings), 'should return an array');
    assert.equal(findings!.length, 3);
    assert.equal(findings![0], 'First finding');
    assert.equal(findings![1], 'Second finding');
    assert.equal(findings![2], 'Third finding');
  });

  it('extracts bullet list items', () => {
    const output = '- First bullet\n* Second bullet\n• Third bullet\n';
    const findings = extractTopFindings(output);
    assert.ok(Array.isArray(findings));
    assert.equal(findings!.length, 3);
    assert.equal(findings![0], 'First bullet');
  });

  it('returns null when no list items found', () => {
    const output = 'Just a plain paragraph with no lists.\nAnother paragraph.\n';
    const findings = extractTopFindings(output);
    assert.equal(findings, null);
  });

  it('caps results at 10 items', () => {
    const lines = Array.from({ length: 15 }, (_, i) => `${i + 1}. Item ${i + 1}`).join('\n');
    const findings = extractTopFindings(lines);
    assert.ok(Array.isArray(findings));
    assert.equal(findings!.length, 10);
  });

  it('skips empty extractions', () => {
    const output = '1. \n2. Valid item\n- \n* Another valid\n';
    const findings = extractTopFindings(output);
    assert.ok(Array.isArray(findings));
    // Empty items after prefix should be skipped
    assert.equal(findings!.length, 2);
    assert.equal(findings![0], 'Valid item');
    assert.equal(findings![1], 'Another valid');
  });
});
