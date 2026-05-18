import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

async function makeTemp(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aco-delegate-'));
}

async function runCli(
  args: string[],
  options: { cwd?: string; home?: string } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  const cliRoot = resolve(__dirname, '..');
  const cliPath = join(cliRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');
  const home = options.home ?? (await makeTemp());
  return new Promise((resolveP) => {
    execFile(
      process.execPath,
      ['--require', tsxRegister, cliPath, ...args],
      {
        cwd: options.cwd ?? cliRoot,
        env: { ...process.env, HOME: home, USERPROFILE: home, NO_COLOR: '1' },
        timeout: 5000,
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? ((error as { code: number }).code ?? 1)
            : error
              ? 1
              : 0;
        resolveP({ code, stdout, stderr });
      }
    );
  });
}

describe('aco delegate CLI', () => {
  it('--help exits 0 and prints usage', async () => {
    const result = await runCli(['delegate', '--help']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /delegate/);
    assert.match(result.stdout, /agent-id/);
    assert.match(result.stdout, /--input/);
  });

  it('-h exits 0 and prints usage', async () => {
    const result = await runCli(['delegate', '-h']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /delegate/);
  });

  it('promptSeedFile resolved relative to agent spec directory', async () => {
    const tmpDir = await makeTemp();
    // Create .claude/agents/test-agent.md with promptSeedFile referencing seeds/
    await mkdir(join(tmpDir, '.claude', 'agents', 'seeds'), { recursive: true });
    await writeFile(
      join(tmpDir, '.claude', 'agents', 'test-agent.md'),
      [
        '---',
        'id: test-agent',
        'promptSeedFile: seeds/test-seed.md',
        '---',
        'Test body.',
      ].join('\n')
    );
    // seed file is at .claude/agents/seeds/test-seed.md (relative to spec dir)
    await writeFile(join(tmpDir, '.claude', 'agents', 'seeds', 'test-seed.md'), 'Seed content.');

    const result = await runCli(['delegate', 'test-agent', '--input', 'my input'], {
      cwd: tmpDir,
    });

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /Seed content\./);
    assert.match(result.stdout, /Test body\./);
    assert.match(result.stdout, /my input/);
  });

  it('missing promptSeedFile exits 1 with resolved absolute path in error', async () => {
    const tmpDir = await makeTemp();
    await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
    await writeFile(
      join(tmpDir, '.claude', 'agents', 'missing-seed-agent.md'),
      ['---', 'id: missing-seed-agent', 'promptSeedFile: nonexistent.md', '---', 'Body.'].join(
        '\n'
      )
    );
    // Do NOT create the nonexistent.md seed file

    const result = await runCli(['delegate', 'missing-seed-agent', '--input', 'test'], {
      cwd: tmpDir,
    });

    assert.equal(result.code, 1);
    // Error message must include the resolved absolute path
    assert.match(result.stderr, /nonexistent\.md/);
    assert.match(result.stderr, /not found/i);
    // Must be an absolute path (starts with /)
    assert.match(result.stderr, /\/.*nonexistent\.md/);
  });

  it('missing agent spec exits 1 with descriptive error', async () => {
    const tmpDir = await makeTemp();
    const result = await runCli(['delegate', 'nonexistent-agent-xyz', '--input', 'test'], {
      cwd: tmpDir,
    });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /not found/i);
    assert.match(result.stderr, /nonexistent-agent-xyz/);
  });

  it('--input-file flag reads content from file', async () => {
    const tmpDir = await makeTemp();
    await mkdir(join(tmpDir, '.claude', 'agents'), { recursive: true });
    await writeFile(
      join(tmpDir, '.claude', 'agents', 'simple-agent.md'),
      ['---', 'id: simple-agent', '---', 'Agent body text.'].join('\n')
    );
    const inputFile = join(tmpDir, 'my-input.txt');
    await writeFile(inputFile, 'File-based input content.');

    const result = await runCli(['delegate', 'simple-agent', '--input-file', inputFile], {
      cwd: tmpDir,
    });

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /File-based input content\./);
    assert.match(result.stdout, /Agent body text\./);
  });
});
