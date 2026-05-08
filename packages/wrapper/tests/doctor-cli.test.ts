import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
  home: string;
}

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aco-doctor-home-'));
}

async function makeWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'aco-doctor-workspace-'));
  await mkdir(join(workspace, '.git'), { recursive: true });
  await mkdir(join(workspace, '.claude', 'commands'), { recursive: true });
  await mkdir(join(workspace, '.claude', 'skills', 'aco-delegation'), { recursive: true });
  await writeFile(join(workspace, 'CLAUDE.md'), '# Test Claude instructions\n');
  await writeFile(join(workspace, '.claude', 'commands', 'aco.md'), 'Run aco ask\n');
  await writeFile(
    join(workspace, '.claude', 'skills', 'aco-delegation', 'SKILL.md'),
    'name: aco-delegation\n'
  );
  return workspace;
}

async function makeFakeBinary(binDir: string, name: string): Promise<void> {
  const binary = join(binDir, name);
  await writeFile(binary, '#!/usr/bin/env node\nprocess.stdout.write("fake cli 1.0.0\\n");\n');
  await chmod(binary, 0o755);
}

async function makeMarkerBinary(binDir: string, name: string, markerPath: string): Promise<void> {
  const binary = join(binDir, name);
  await writeFile(
    binary,
    `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(markerPath)}, 'executed');\nprocess.stdout.write('should-not-run\\n');\n`
  );
  await chmod(binary, 0o755);
}

async function runCli(
  args: string[],
  options: { home?: string; cwd?: string; env?: Record<string, string | undefined> } = {}
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
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          NO_COLOR: '1',
          ...options.env,
        },
        timeout: 5000,
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

describe('aco doctor CLI', () => {
  it('prints local health checks without secrets or provider invocation', async () => {
    const home = await makeHome();
    const workspace = await makeWorkspace();
    const binDir = await mkdtemp(join(tmpdir(), 'aco-doctor-bin-'));
    await makeFakeBinary(binDir, 'codex');
    await makeFakeBinary(binDir, 'gemini');

    const result = await runCli(['doctor'], {
      home,
      cwd: workspace,
      env: {
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        OPENAI_API_KEY: 'secret-openai-key',
        GEMINI_API_KEY: 'secret-gemini-key',
      },
    });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /aco doctor/);
    assert.match(result.stdout, /Node:/);
    assert.match(result.stdout, /aco version: 0\.4\.0/);
    assert.match(result.stdout, /Git repository:/);
    assert.match(result.stdout, /\.claude harness:/);
    assert.match(result.stdout, /\/aco command:/);
    assert.match(result.stdout, /aco-delegation skill:/);
    assert.match(result.stdout, /mock:/);
    assert.match(result.stdout, /codex:/);
    assert.match(result.stdout, /gemini:/);
    assert.match(result.stdout, /remote auth verification: not performed/);
    assert.match(result.stdout, /Sync drift: not configured \(sync manifest missing\)/);
    assert.doesNotMatch(result.stdout, /secret-openai-key/);
    assert.doesNotMatch(result.stdout, /secret-gemini-key/);
    assert.doesNotMatch(result.stdout, /Provider: mock/);
    assert.equal(existsSync(join(home, '.aco', 'provider-auth-cache.json')), false);
  });

  it('reports missing harness surfaces without failing the local diagnostic', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'aco-doctor-empty-workspace-'));
    const result = await runCli(['doctor'], { cwd: workspace, env: { PATH: '' } });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /\.claude harness: missing/);
    assert.match(result.stdout, /\/aco command: missing/);
    assert.match(result.stdout, /aco-delegation skill: missing/);
    assert.match(result.stdout, /codex: missing/);
    assert.match(result.stdout, /gemini: missing/);
    assert.match(result.stdout, /mock: ready/);
  });

  it('does not execute provider binaries while checking local readiness', async () => {
    const home = await makeHome();
    const workspace = await makeWorkspace();
    const binDir = await mkdtemp(join(tmpdir(), 'aco-doctor-marker-bin-'));
    const codexMarker = join(home, 'codex-executed');
    const geminiMarker = join(home, 'gemini-executed');
    await makeMarkerBinary(binDir, 'codex', codexMarker);
    await makeMarkerBinary(binDir, 'gemini', geminiMarker);

    const result = await runCli(['doctor'], {
      home,
      cwd: workspace,
      env: {
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        OPENAI_API_KEY: '',
        GEMINI_API_KEY: '',
        GOOGLE_API_KEY: '',
      },
    });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /codex:/);
    assert.match(result.stdout, /gemini:/);
    assert.equal(existsSync(codexMarker), false);
    assert.equal(existsSync(geminiMarker), false);
  });

  it('reports sync manifests that point at another checkout', async () => {
    const workspace = await makeWorkspace();
    await mkdir(join(workspace, '.aco'), { recursive: true });
    await writeFile(
      join(workspace, '.aco', 'sync-manifest.json'),
      JSON.stringify(
        {
          version: '2',
          sourceHashes: {
            '/other/checkout/CLAUDE.md': 'hash',
          },
          targetHashes: {},
          targets: {},
        },
        null,
        2
      )
    );

    const result = await runCli(['doctor'], { cwd: workspace });

    assert.equal(result.code, 0);
    assert.match(
      result.stdout,
      /Sync drift: needs attention \(sync manifest points at another checkout\)/
    );
  });

  it('reports missing HOME and USERPROFILE in auth heuristics without crashing', async () => {
    const home = await makeHome();
    const workspace = await makeWorkspace();
    const binDir = await mkdtemp(join(tmpdir(), 'aco-doctor-bin-'));
    await makeFakeBinary(binDir, 'codex');
    await makeFakeBinary(binDir, 'gemini');

    const result = await runCli(['doctor'], {
      home,
      cwd: workspace,
      env: {
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        HOME: undefined,
        USERPROFILE: undefined,
      },
    });

    assert.equal(result.code, 0);
    assert.match(
      result.stdout,
      /codex: available; local auth heuristic missing \(no HOME or USERPROFILE set; codex login OR export OPENAI_API_KEY\)/
    );
    assert.match(
      result.stdout,
      /gemini: available; local auth heuristic missing \(no HOME or USERPROFILE set; gemini auth login OR export GEMINI_API_KEY\)/
    );
  });
});
