/**
 * Fixture harness skeleton for the aco wrapper behavioral contract.
 *
 * Usage:
 *   npm run test:fixtures -- --binary <path-to-aco-binary>
 *
 * Each fixture is an async function that receives a BinaryRunner and
 * makes assertions. The harness collects results and reports pass/fail.
 *
 * This file is a SKELETON. Individual fixture assertions are defined in
 * each fixture's assertions.ts file (imported below).
 *
 * Implementation note: replace this skeleton with a real test runner
 * (e.g., node:test, vitest) when starting Go wrapper development.
 * The interface contract below is normative; the runner framework is not.
 */

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// BinaryRunner — the interface each fixture receives
// ---------------------------------------------------------------------------

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** Chunks received in order, with timestamps */
  chunks: Array<{ text: string; receivedAt: number }>;
}

export interface BinaryRunner {
  /** Binary under test */
  readonly binaryPath: string;

  /** Path inside the isolated mock PATH dir for a provider binary name. */
  providerPath(name: string): string;

  /**
   * Run `aco <args>` and collect output.
   * Resolves after the process exits.
   */
  run(args: string[], opts?: { stdinContent?: string; timeoutMs?: number; mockPathOnly?: boolean }): Promise<RunResult>;

  /**
   * Spawn `aco run` and return the ChildProcess handle.
   * Used for fixtures that need to interact with the process mid-run
   * (e.g., send cancel while running).
   */
  spawn(args: string[], opts?: { mockPathOnly?: boolean }): ChildProcess;

  /**
   * Read task.json for the given session ID from the test session store.
   * Uses the isolated session store dir, not the real ~/.aco/sessions.
   */
  readTaskJson(sessionId: string): Promise<TaskJson>;

  /**
   * Read output.log for the given session ID.
   */
  readOutputLog(sessionId: string): Promise<string>;

  /**
   * Read error.log for the given session ID.
   */
  readErrorLog(sessionId: string): Promise<string>;

  /**
   * Read the latest session ID from the pointer file.
   */
  readLatestSessionId(): Promise<string | null>;

  /**
   * Session store base directory (isolated per test run).
   */
  readonly sessionBaseDir: string;
}

// ---------------------------------------------------------------------------
// TaskJson — matches the session schema contract
// ---------------------------------------------------------------------------

export interface TaskJson {
  id: string;
  provider: string;
  command: string;
  status: 'running' | 'done' | 'failed' | 'cancelled';
  startedAt: string;
  pid?: number;
  permissionProfile?: string;
  endedAt?: string;
  exitCode?: number;
  signal?: string;
}

// ---------------------------------------------------------------------------
// Fixture definition
// ---------------------------------------------------------------------------

export interface FixtureResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export type FixtureFn = (runner: BinaryRunner) => Promise<void>;

export interface Fixture {
  name: string;
  fn: FixtureFn;
  /**
   * If true, this fixture is expected to fail against the Node binary
   * (known implementation gap). It is still run and must pass against
   * the Go binary.
   */
  knownNodeGap?: boolean;
}

// ---------------------------------------------------------------------------
// Fixture registry (populated by importing each fixture's assertions.ts)
// ---------------------------------------------------------------------------

const fixtures: Fixture[] = [];

export function registerFixture(f: Fixture): void {
  fixtures.push(f);
}

// ---------------------------------------------------------------------------
// Mock provider binary factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock provider binary script at the given path.
 * The script simulates a provider that:
 * - Writes `chunkCount` lines of output with `delayMs` between each
 * - Exits with `exitCode`
 *
 * Returns the path to the script.
 */
export async function createMockProvider(opts: {
  path: string;
  chunkCount?: number;
  chunkDelayMs?: number;
  exitCode?: number;
  exitSignal?: string;
  stderrContent?: string;
  hangForever?: boolean;
}): Promise<string> {
  const {
    path: scriptPath,
    chunkCount = 3,
    chunkDelayMs = 50,
    exitCode = 0,
    stderrContent,
    hangForever = false,
  } = opts;

  const lines: string[] = ['#!/usr/bin/env bash', 'set -e'];

  if (stderrContent) {
    lines.push(`echo "${stderrContent}" >&2`);
  }

  if (hangForever) {
    lines.push('sleep 999');
  } else {
    for (let i = 0; i < chunkCount; i++) {
      lines.push(`sleep ${(chunkDelayMs / 1000).toFixed(3)}`);
      lines.push(`echo "chunk ${i + 1} of ${chunkCount}"`);
    }
    if (exitCode !== 0) {
      lines.push(`exit ${exitCode}`);
    }
  }

  await writeFile(scriptPath, lines.join('\n') + '\n', { mode: 0o755 });
  return scriptPath;
}

// ---------------------------------------------------------------------------
// Harness runner implementation (skeleton — replace with real test framework)
// ---------------------------------------------------------------------------

class BinaryRunnerImpl implements BinaryRunner {
  constructor(
    readonly binaryPath: string,
    readonly sessionBaseDir: string,
    private readonly mockBinDir: string,
  ) {}

  private get env(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ACO_SESSION_DIR: this.sessionBaseDir,
      PATH: `${this.mockBinDir}:${process.env['PATH'] ?? ''}`,
    };
  }

  private envFor(opts?: { mockPathOnly?: boolean }): NodeJS.ProcessEnv {
    if (!opts?.mockPathOnly) {
      return this.env;
    }
    return {
      ...process.env,
      ACO_SESSION_DIR: this.sessionBaseDir,
      PATH: this.mockBinDir,
    };
  }

  providerPath(name: string): string {
    return join(this.mockBinDir, name);
  }

  async run(args: string[], opts: { stdinContent?: string; timeoutMs?: number; mockPathOnly?: boolean } = {}): Promise<RunResult> {
    const chunks: Array<{ text: string; receivedAt: number }> = [];
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(this.binaryPath, args, {
        env: this.envFor(opts),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        chunks.push({ text, receivedAt: Date.now() - startedAt });
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      if (opts.stdinContent && child.stdin) {
        child.stdin.write(opts.stdinContent);
        child.stdin.end();
      } else if (child.stdin) {
        child.stdin.end();
      }

      const timer = opts.timeoutMs
        ? setTimeout(() => { child.kill('SIGKILL'); }, opts.timeoutMs)
        : undefined;

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 1, chunks });
      });

      child.on('error', reject);
    });
  }

  spawn(args: string[], opts: { mockPathOnly?: boolean } = {}): ChildProcess {
    return spawn(this.binaryPath, args, {
      env: this.envFor(opts),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  async readTaskJson(sessionId: string): Promise<TaskJson> {
    const path = join(this.sessionBaseDir, sessionId, 'task.json');
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as TaskJson;
  }

  async readOutputLog(sessionId: string): Promise<string> {
    const path = join(this.sessionBaseDir, sessionId, 'output.log');
    return readFile(path, 'utf8').catch(() => '');
  }

  async readErrorLog(sessionId: string): Promise<string> {
    const path = join(this.sessionBaseDir, sessionId, 'error.log');
    return readFile(path, 'utf8').catch(() => '');
  }

  async readLatestSessionId(): Promise<string | null> {
    const path = join(this.sessionBaseDir, 'latest');
    return readFile(path, 'utf8').then((s) => s.trim() || null).catch(() => null);
  }
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const binaryArg = process.argv.find((a, i) => process.argv[i - 1] === '--binary');
  if (!binaryArg) {
    console.error('Usage: npx ts-node test/fixtures/harness.ts --binary <path>');
    process.exit(1);
  }

  // Import all fixture assertions
  // (these files call registerFixture() as a side effect)
  await import('./01-streaming-output/assertions');
  await import('./05-exit-code-recording/assertions');
  await import('./06-timeout-marking/assertions');
  await import('./07-provider-not-found/assertions');
  await import('./08-auth-failure/assertions');

  const results: FixtureResult[] = [];

  for (const fixture of fixtures) {
    const sessionBaseDir = await mkdtemp(join(tmpdir(), 'aco-fixture-sessions-'));
    const mockBinDir = await mkdtemp(join(tmpdir(), 'aco-fixture-bin-'));

    try {
      await mkdir(sessionBaseDir, { recursive: true });
      const runner = new BinaryRunnerImpl(binaryArg, sessionBaseDir, mockBinDir);
      const start = Date.now();
      try {
        await fixture.fn(runner);
        results.push({ name: fixture.name, passed: true, durationMs: Date.now() - start });
      } catch (err) {
        results.push({
          name: fixture.name,
          passed: false,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        });
      }
    } finally {
      await rm(sessionBaseDir, { recursive: true, force: true });
      await rm(mockBinDir, { recursive: true, force: true });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\nFixture Results:');
  for (const r of results) {
    const icon = r.passed ? '✓' : '✗';
    console.log(`  ${icon} ${r.name} (${r.durationMs}ms)${r.error ? `: ${r.error}` : ''}`);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
