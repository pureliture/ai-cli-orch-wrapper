/**
 * Smoke test: verify aco providers and no-auth mock demo commands are available at runtime.
 * Migrated from .claude/aco/tests/smoke-adapters.sh
 *
 * Run: npx tsx tests/smoke.ts [gemini|all]
 */
import { ProviderRegistry } from '../src/providers/registry.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const registry = new ProviderRegistry();
const target = process.argv[2] ?? 'all';

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean): void {
  if (ok) {
    console.log(`PASS: ${name}`);
    pass++;
  } else {
    console.error(`FAIL: ${name}`);
    fail++;
  }
}

function testProvider(key: string): void {
  const provider = registry.get(key);
  check(`${key} registered in registry`, provider !== undefined);
  if (!provider) return;
  check(`${key} has non-empty installHint`, provider.installHint.length > 0);

  const available = provider.isAvailable();
  if (key === 'mock') {
    console.log(`INFO: ${key} provider is built in`);
    check(`${key} isAvailable() returns true`, available === true);
    return;
  }

  if (available) {
    console.log(`INFO: ${key} binary found in PATH`);
    check(`${key} isAvailable() returns true`, true);
  } else {
    console.log(`INFO: ${key} binary NOT in PATH — skipping auth check`);
  }
}

if (target === 'antigravity' || target === 'all') testProvider('antigravity');
if (target === 'mock' || target === 'all') testProvider('mock');

if (target === 'mock' || target === 'all') {
  const cliRoot = resolve(__dirname, '..');
  const cliPath = join(cliRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');
  const home = mkdtempSync(join(tmpdir(), 'aco-smoke-home-'));
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    NO_COLOR: '1',
  };

  try {
    const dryRun = execFileSync(
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
        '--dry-run',
      ],
      { cwd: cliRoot, env, encoding: 'utf8' }
    );
    check(
      'mock ask dry-run skips provider execution',
      dryRun.includes('Provider execution: skipped')
    );

    const brief = execFileSync(
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
        'brief',
      ],
      { cwd: cliRoot, env, encoding: 'utf8' }
    );
    check('mock ask brief prints bounded summary', brief.includes('Summary:'));

    const result = execFileSync(process.execPath, ['--require', tsxRegister, cliPath, 'result'], {
      cwd: cliRoot,
      env,
      encoding: 'utf8',
    });
    check('aco result reads latest mock output', result.includes('Provider: mock'));

    const doctor = execFileSync(process.execPath, ['--require', tsxRegister, cliPath, 'doctor'], {
      cwd: cliRoot,
      env,
      encoding: 'utf8',
    });
    check('aco doctor reports local diagnostics', doctor.includes('aco doctor'));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    check('mock demo command sequence', false);
  }
}

console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
