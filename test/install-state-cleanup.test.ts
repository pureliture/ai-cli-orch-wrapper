/**
 * Install-state cleanup tests
 *
 * Locks the stale global-bin cleanup contract for the Phase 04 `aco` cutover.
 */

import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';

const PROJECT_ROOT = join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..');
const CLEANUP_SCRIPT_PATH = join(PROJECT_ROOT, 'scripts', 'cleanup-legacy-bin.mjs');

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'aco-install-state-cleanup-'));
}

function writePackageRoot(baseDir: string): { packageRoot: string; packageCliPath: string } {
  const packageRoot = join(baseDir, 'package-root');
  const distDir = join(packageRoot, 'dist');

  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({
    name: 'ai-cli-orch-wrapper',
    version: '0.2.0-test',
    type: 'module',
    bin: {
      aco: 'dist/cli.js',
    },
  }, null, 2), 'utf8');
  writeFileSync(join(distDir, 'cli.js'), '#!/usr/bin/env node\nconsole.log("aco test cli");\n', 'utf8');

  return {
    packageRoot,
    packageCliPath: join(distDir, 'cli.js'),
  };
}

function writePrefix(baseDir: string): { prefix: string; binDir: string } {
  const prefix = join(baseDir, 'global-prefix');
  const binDir = join(prefix, 'bin');

  mkdirSync(binDir, { recursive: true });

  return { prefix, binDir };
}

function runCleanup(packageRoot: string, prefix: string, platform = process.platform) {
  return spawnSync(process.execPath, [CLEANUP_SCRIPT_PATH], {
    cwd: packageRoot,
    env: {
      ...process.env,
      ACO_BIN_CLEANUP_PACKAGE_ROOT: packageRoot,
      ACO_BIN_CLEANUP_PREFIX: prefix,
      ACO_BIN_CLEANUP_PLATFORM: platform,
    },
    encoding: 'utf8',
  });
}

test('removes a stale wrapper symlink when it resolves to this package dist/cli.js', () => {
  const tempDir = makeTempDir();
  const { packageRoot, packageCliPath } = writePackageRoot(tempDir);
  const { prefix, binDir } = writePrefix(tempDir);
  const acoBin = join(binDir, 'aco');
  const wrapperBin = join(binDir, 'wrapper');

  symlinkSync(packageCliPath, acoBin);
  symlinkSync(packageCliPath, wrapperBin);

  const result = runCleanup(packageRoot, prefix, 'darwin');

  assert.equal(result.status, 0);
  assert.equal(existsSync(wrapperBin), false);
  assert.equal(realpathSync(acoBin), realpathSync(packageCliPath));
  assert.match(result.stdout, /removed/i);
});

test('keeps the canonical aco symlink in place during cleanup', () => {
  const tempDir = makeTempDir();
  const { packageRoot, packageCliPath } = writePackageRoot(tempDir);
  const { prefix, binDir } = writePrefix(tempDir);
  const acoBin = join(binDir, 'aco');
  const wrapperBin = join(binDir, 'wrapper');

  symlinkSync(packageCliPath, acoBin);
  symlinkSync(packageCliPath, wrapperBin);

  const result = runCleanup(packageRoot, prefix, 'darwin');

  assert.equal(result.status, 0);
  assert.equal(existsSync(acoBin), true);
  assert.equal(realpathSync(acoBin), realpathSync(packageCliPath));
});

test('skips removal when wrapper points somewhere unrelated', () => {
  const tempDir = makeTempDir();
  const { packageRoot, packageCliPath } = writePackageRoot(tempDir);
  const { prefix, binDir } = writePrefix(tempDir);
  const unrelatedTarget = join(tempDir, 'elsewhere', 'wrapper');
  const wrapperBin = join(binDir, 'wrapper');

  mkdirSync(join(tempDir, 'elsewhere'), { recursive: true });
  writeFileSync(unrelatedTarget, '#!/usr/bin/env node\nconsole.log("other wrapper");\n', 'utf8');
  symlinkSync(unrelatedTarget, wrapperBin);

  const result = runCleanup(packageRoot, prefix, 'darwin');

  assert.equal(result.status, 0);
  assert.equal(existsSync(wrapperBin), true);
  assert.equal(realpathSync(wrapperBin), realpathSync(unrelatedTarget));
  assert.notEqual(realpathSync(wrapperBin), realpathSync(packageCliPath));
  assert.match(result.stdout, /skipped/i);
});

test('exits successfully when no legacy shim exists', () => {
  const tempDir = makeTempDir();
  const { packageRoot } = writePackageRoot(tempDir);
  const { prefix } = writePrefix(tempDir);

  const result = runCleanup(packageRoot, prefix, 'darwin');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /found nothing/i);
});
