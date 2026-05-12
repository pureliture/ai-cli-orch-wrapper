import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const wrapperRoot = resolve(__dirname, '..');
const tempRoot = mkdtempSync(join(tmpdir(), 'aco-pack-runtime-smoke-'));
const generatedPackageTemplates = join(wrapperRoot, 'templates');

function exec(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): string {
  return execFileSync(command, args, {
    cwd: options.cwd ?? wrapperRoot,
    env: {
      ...process.env,
      NO_COLOR: '1',
      ...options.env,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): { stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? wrapperRoot,
    env: {
      ...process.env,
      NO_COLOR: '1',
      ...options.env,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited ${result.status}\n${result.stdout}\n${result.stderr}`
    );
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

try {
  const packJson = exec('npm', ['pack', '--json', '--pack-destination', tempRoot]);
  const packResult = JSON.parse(packJson) as Array<{
    filename: string;
    files: Array<{ path: string }>;
  }>;
  const packed = packResult[0];
  assert.ok(packed, 'npm pack did not return package metadata');
  const packedFiles = new Set(packed.files.map((file) => file.path));

  for (const required of [
    'dist/cli.js',
    'templates/commands/aco.md',
    'templates/prompts/gemini/review.md',
    'templates/prompts/codex/review.md',
    'templates/tasks/review.md',
    'templates/tasks/spec-critique.md',
    'templates/tasks/plan-critique.md',
    'templates/tasks/tdd.md',
    'templates/tasks/code-simplify.md',
    'templates/tasks/default.md',
  ]) {
    assert.equal(packedFiles.has(required), true, `missing packed file: ${required}`);
  }

  const prefix = join(tempRoot, 'prefix');
  const home = join(tempRoot, 'home');
  const project = join(tempRoot, 'project');
  const fakeBin = join(tempRoot, 'fake-bin');
  const tarball = join(tempRoot, packed.filename);
  mkdirSync(home, { recursive: true });
  mkdirSync(project, { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  const fakeGemini = join(fakeBin, 'gemini');
  writeFileSync(
    fakeGemini,
    '#!/usr/bin/env node\nprocess.stdout.write("fake gemini saw prompt\\n" + process.argv.join("\\n"));\n'
  );
  chmodSync(fakeGemini, 0o755);
  exec(
    'npm',
    ['install', '--prefix', prefix, '--no-audit', '--no-fund', '--ignore-scripts', tarball],
    {
      cwd: tempRoot,
    }
  );

  const binDir = join(prefix, 'node_modules', '.bin');
  const env = {
    HOME: home,
    USERPROFILE: home,
    PATH: `${binDir}${delimiter}${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
  };

  const version = exec('aco', ['--version'], { cwd: project, env });
  const packageJson = JSON.parse(readFileSync(join(wrapperRoot, 'package.json'), 'utf8')) as {
    version: string;
  };
  assert.equal(version.trim(), `aco ${packageJson.version}`);

  exec('aco', ['pack', 'setup'], { cwd: project, env });

  for (const preset of [
    'review',
    'spec-critique',
    'plan-critique',
    'tdd',
    'code-simplify',
    'default',
  ]) {
    const dryRun = exec('aco', ['ask', '--preset', preset, '--dry-run'], { cwd: project, env });
    assert.match(dryRun, new RegExp(`Preset: ${preset}`));
    assert.match(dryRun, /Provider execution: skipped/);
  }

  const review = run('aco', ['run', 'gemini', 'review', '--input', 'demo'], { cwd: project, env });
  assert.match(review.stdout, /fake gemini saw prompt/);
  assert.match(review.stderr, /\.claude\/aco\/prompts\/gemini\/review\.md/);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  rmSync(generatedPackageTemplates, { recursive: true, force: true });
}
