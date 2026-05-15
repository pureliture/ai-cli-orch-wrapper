import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { isCredentialLikePath, findCredentialEnvKeys } from '../src/util/credential-guard.js';

// ---------------------------------------------------------------------------
// 6.1  isCredentialLikePath: pattern matching
// ---------------------------------------------------------------------------

describe('isCredentialLikePath: credential pattern detection', () => {
  const credentialPaths = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.test',
    'auth.json',
    'credentials.json',
    'creds.json',
    'api_credentials.json',
    'db_creds.json',
    'id_rsa',
    'id_ed25519',
    'id_dsa',
    'id_ecdsa',
    'server.pem',
    'private.key',
    'keystore.pfx',
    'cert.p12',
    'secrets.json',
    'secrets.yaml',
    'secrets.yml',
    '.codex/auth.json',
    '.gemini/oauth_creds.json',
  ];

  for (const p of credentialPaths) {
    it(`blocks "${p}"`, () => {
      assert.equal(isCredentialLikePath(p), true, `Expected "${p}" to be credential-like`);
    });
  }

  const safePaths = [
    'CLAUDE.md',
    'README.md',
    'src/index.ts',
    'docs/overview.md',
    'config.json',
    'package.json',
    'tsconfig.json',
    '.claude/settings.json',
    'auth-service.ts',
    'key-value-store.ts',
  ];

  for (const p of safePaths) {
    it(`allows "${p}"`, () => {
      assert.equal(isCredentialLikePath(p), false, `Expected "${p}" to be safe`);
    });
  }
});

// ---------------------------------------------------------------------------
// 6.2~6.4  CLI integration: --input-file guard behavior
// ---------------------------------------------------------------------------

async function runAskCli(
  args: string[],
  options: { env?: Record<string, string>; cwd?: string } = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const cliRoot = resolve(__dirname, '..');
  const cliPath = join(cliRoot, 'src', 'cli.ts');
  const tsxRegister = require.resolve('tsx/cjs');

  return new Promise((res) => {
    execFile(
      process.execPath,
      ['--require', tsxRegister, cliPath, ...args],
      {
        cwd: options.cwd ?? cliRoot,
        env: { ...process.env, NO_COLOR: '1', ...options.env },
        timeout: 8000,
      },
      (error, stdout, stderr) => {
        const code = error && 'code' in error ? (error as NodeJS.ErrnoException & { code?: number }).code as number | null : 0;
        res({ code, stdout, stderr });
      }
    );
  });
}

describe('ask --input-file credential guard: CLI behavior', () => {
  it('6.2: blocks .env file without --allow-sensitive', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-guard-test-'));
    try {
      const envFile = join(tmpDir, '.env');
      await writeFile(envFile, 'SECRET=hello');

      const result = await runAskCli([
        'ask',
        '--task',
        'test',
        '--providers',
        'mock',
        '--input-file',
        envFile,
        '--yes',
      ]);

      assert.ok(
        result.code !== 0,
        `Expected non-zero exit code, got: ${result.code}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
      );
      const output = result.stdout + result.stderr;
      assert.ok(
        output.includes('Blocked') || output.includes('credential'),
        `Expected blocking message, got:\n${output}`
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('6.3: allows .env file with --allow-sensitive and shows warning', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-guard-allow-'));
    try {
      const envFile = join(tmpDir, '.env');
      await writeFile(envFile, 'SECRET=hello');

      const result = await runAskCli([
        'ask',
        '--task',
        'test',
        '--providers',
        'mock',
        '--input-file',
        envFile,
        '--yes',
        '--allow-sensitive',
      ]);

      assert.ok(
        result.stderr.includes('warning') || result.stderr.includes('sensitive'),
        `Expected warning in stderr, got:\n${result.stderr}`
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('6.4: allows regular .md file without any guard', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'aco-guard-safe-'));
    try {
      const mdFile = join(tmpDir, 'overview.md');
      await writeFile(mdFile, '# Overview\n\nSome safe content.');

      const result = await runAskCli([
        'ask',
        '--task',
        'test',
        '--providers',
        'mock',
        '--input-file',
        mdFile,
        '--yes',
      ]);

      const output = result.stdout + result.stderr;
      assert.ok(
        !output.includes('Blocked') && !output.includes('credential-like'),
        `Expected no blocking for safe file, got:\n${output}`
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 8.1~8.2  findCredentialEnvKeys: env var warning detection
// ---------------------------------------------------------------------------

describe('findCredentialEnvKeys: credential env var detection', () => {
  it('8.1: detects credential-like env vars by suffix', () => {
    const env: Record<string, string> = {
      GITHUB_TOKEN: 'ghp_xxx',
      OPENAI_API_KEY: 'sk-xxx',
      DB_PASSWORD: 'secret',
      MY_SECRET: 'hidden',
      PRIVATE_KEY: 'pem-data',
      SAFE_VAR: 'hello',
      PATH: '/usr/bin',
      HOME: '/home/user',
    };
    const keys = findCredentialEnvKeys(env);
    assert.ok(keys.includes('GITHUB_TOKEN'), `Expected GITHUB_TOKEN in: ${JSON.stringify(keys)}`);
    assert.ok(keys.includes('OPENAI_API_KEY'), `Expected OPENAI_API_KEY in: ${JSON.stringify(keys)}`);
    assert.ok(keys.includes('DB_PASSWORD'), `Expected DB_PASSWORD in: ${JSON.stringify(keys)}`);
    assert.ok(keys.includes('MY_SECRET'), `Expected MY_SECRET in: ${JSON.stringify(keys)}`);
    assert.ok(keys.includes('PRIVATE_KEY'), `Expected PRIVATE_KEY in: ${JSON.stringify(keys)}`);
    assert.ok(!keys.includes('SAFE_VAR'), `SAFE_VAR should not be in: ${JSON.stringify(keys)}`);
    assert.ok(!keys.includes('PATH'), `PATH should not be in: ${JSON.stringify(keys)}`);
    assert.ok(!keys.includes('HOME'), `HOME should not be in: ${JSON.stringify(keys)}`);
  });

  it('8.2: returns empty array when no credential env vars present', () => {
    const env: Record<string, string> = {
      PATH: '/usr/bin:/usr/local/bin',
      HOME: '/home/user',
      LANG: 'en_US.UTF-8',
      TERM: 'xterm-256color',
    };
    const keys = findCredentialEnvKeys(env);
    assert.deepEqual(keys, [], `Expected no credential keys, got: ${JSON.stringify(keys)}`);
  });
});
