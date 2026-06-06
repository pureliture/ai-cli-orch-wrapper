import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { delimiter, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, readdir, readFile, stat, writeFile, rm } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { SessionOrchestrator } from '../src/runtime/session-orchestrator.js';
import type {
  ISessionStore,
  IProviderRegistry,
  IProviderRunner,
  ICancellationInstaller,
} from '../src/runtime/session-orchestrator.js';
import type { TaskRecord } from '../src/session/store.js';
import type { IProvider, AuthResult, InvokeOptions } from '../src/providers/interface.js';
import type {
  ProviderSessionRunOptions,
  ProviderSessionRunResult,
} from '../src/runtime/provider-session-runner.js';
import type {
  ProviderCancellationHandlerDeps,
  ProviderCancellationHandle,
} from '../src/runtime/provider-cancellation.js';
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
  const promptDir = join(workspace, '.claude', 'aco', 'prompts', 'antigravity');
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

function makeFakeAgyBody(runtimeBody: string): string {
  return [
    "if (process.argv.includes('--version')) {",
    "  process.stdout.write('agy-test 0.0.0\\n');",
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
          PATH: options.pathPrefix
            ? `${options.pathPrefix}${delimiter}${process.env.PATH ?? ''}`
            : process.env.PATH,
          ...options.env,
        },
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
      'agy',
      makeFakeAgyBody("process.stdout.write('should not run\\n');")
    );

    const runResult = await runCli(['run', 'antigravity', 'review', '--timeout', '0'], {
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
      'agy',
      makeFakeAgyBody(
        [
          "process.stdout.write('partial output before timeout\\n');",
          "setTimeout(() => { process.stdout.write('late output\\n'); process.exit(0); }, 3000);",
        ].join('\n')
      )
    );

    const result = await runCli(
      ['run', 'antigravity', 'review', '--input', 'demo', '--timeout', '1'],
      {
        cwd: workspace,
        pathPrefix: binDir,
        // 전체 테스트 실행 시 시스템 부하로 Node.js + tsx 초기화가 5초를 초과하는 flake 방지.
        // 단독 실행 시 ~2-3초이므로 10초는 충분한 여유를 제공한다.
        timeoutMs: 10_000,
      }
    );

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

    assert.equal(task.provider, 'antigravity');
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
      'agy',
      makeFakeAgyBody(
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
        'antigravity',
        '--task',
        'demo',
        '--yes',
        '--output-mode',
        'save-only',
        '--timeout',
        '1',
      ],
      // 전체 테스트 실행 시 시스템 부하로 Node.js + tsx 초기화가 5초를 초과하는 flake 방지.
      { cwd: workspace, pathPrefix: binDir, timeoutMs: 10_000 }
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

  // 인메모리 테스트 더블 정의
  class InMemorySessionStore implements ISessionStore {
    public sessions = new Map<string, TaskRecord>();
    public errorLogs = new Map<string, string>();
    public outputs = new Map<string, string>();
    private nextId = 1;
    private tmpDir: string;

    constructor(tmpDir: string) {
      this.tmpDir = tmpDir;
    }

    async create(
      provider: string,
      command: string,
      pid?: number,
      permissionProfile?: string
    ): Promise<TaskRecord> {
      const id = `session-${this.nextId++}`;
      const record: TaskRecord = {
        id,
        provider,
        command,
        status: 'running',
        pid,
        permissionProfile: permissionProfile as any,
        startedAt: new Date().toISOString(),
      };
      this.sessions.set(id, record);
      return record;
    }

    async update(id: string, patch: Partial<TaskRecord>): Promise<TaskRecord> {
      const record = this.sessions.get(id);
      if (!record) throw new Error(`Session not found: ${id}`);
      const updated = { ...record, ...patch };
      this.sessions.set(id, updated);
      return updated;
    }

    async read(id: string): Promise<TaskRecord> {
      const record = this.sessions.get(id);
      if (!record) throw new Error(`Session not found: ${id}`);
      return record;
    }

    async markDone(id: string): Promise<void> {
      await this.update(id, { status: 'done', endedAt: new Date().toISOString() });
    }

    async markFailed(id: string): Promise<void> {
      await this.update(id, { status: 'failed', endedAt: new Date().toISOString() });
    }

    async markCancelled(id: string): Promise<void> {
      await this.update(id, { status: 'cancelled', endedAt: new Date().toISOString() });
    }

    errorLogPath(id: string): string {
      return join(this.tmpDir, `${id}-error.log`);
    }

    createOutputTee(id: string): Writable {
      const self = this;
      return new Writable({
        write(chunk, encoding, callback) {
          const current = self.outputs.get(id) ?? '';
          self.outputs.set(id, current + chunk.toString());
          callback();
        },
      });
    }
  }

  class FakeProvider implements IProvider {
    constructor(public readonly key: string) {}
    readonly installHint = 'Fake hint';
    readonly icon = '⚪';
    isAvailable(): boolean {
      return true;
    }
    async checkAuth(): Promise<AuthResult> {
      return { ok: true };
    }
    buildArgs(command: string, options?: InvokeOptions): string[] {
      return [];
    }
    async *invoke(
      command: string,
      prompt: string,
      content: string,
      options?: InvokeOptions
    ): AsyncIterable<string> {
      yield 'fake response';
    }
  }

  class FakeProviderRegistry implements IProviderRegistry {
    private providers = new Map<string, IProvider>();
    register(key: string, provider: IProvider) {
      this.providers.set(key, provider);
    }
    get(key: string): IProvider | undefined {
      return this.providers.get(key);
    }
  }

  class FakeProviderRunner implements IProviderRunner {
    public lastOptions?: ProviderSessionRunOptions;
    public runImplementation?: (
      options: ProviderSessionRunOptions
    ) => Promise<ProviderSessionRunResult>;

    async run(options: ProviderSessionRunOptions): Promise<ProviderSessionRunResult> {
      this.lastOptions = options;
      if (this.runImplementation) {
        return this.runImplementation(options);
      }
      if (options.onPid) {
        options.onPid(12345);
      }
      options.output.write('mock output');
      return {
        hasOutput: true,
        totalBytesStreamed: 11,
      };
    }
  }

  class MockCancellationInstaller implements ICancellationInstaller {
    public lastDeps?: ProviderCancellationHandlerDeps;
    public installedHandles: ProviderCancellationHandle[] = [];

    triggerCancel(sessionId: string): Promise<void> {
      if (this.lastDeps && this.lastDeps.state.sessionId === sessionId) {
        return this.lastDeps.markCancelled(sessionId);
      }
      return Promise.resolve();
    }

    install(deps: ProviderCancellationHandlerDeps): ProviderCancellationHandle {
      this.lastDeps = deps;
      const handle = {
        dispose: () => {
          const idx = this.installedHandles.indexOf(handle);
          if (idx !== -1) {
            this.installedHandles.splice(idx, 1);
          }
        },
      };
      this.installedHandles.push(handle);
      return handle;
    }
  }

  describe('SessionOrchestrator in-memory state transitions', () => {
    let tmpDir: string;
    let store: InMemorySessionStore;
    let registry: FakeProviderRegistry;
    let runner: FakeProviderRunner;
    let installer: MockCancellationInstaller;
    let orchestrator: SessionOrchestrator;
    let provider: FakeProvider;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'aco-orchestrator-test-'));
      store = new InMemorySessionStore(tmpDir);
      registry = new FakeProviderRegistry();
      runner = new FakeProviderRunner();
      installer = new MockCancellationInstaller();
      orchestrator = new SessionOrchestrator({
        sessionStore: store,
        providerRegistry: registry,
        providerRunner: runner,
        cancellationInstaller: installer,
      });
      provider = new FakeProvider('mock-provider');
      registry.register('mock-provider', provider);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('transitions to done on success', async () => {
      await orchestrator.run({
        providerKey: 'mock-provider',
        command: 'review-in-memory',
        permissionProfile: 'default',
        inputContent: 'hello',
        cwd: tmpDir,
        home: tmpDir,
      });

      const sessions = Array.from(store.sessions.values());
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].status, 'done');
      assert.equal(store.outputs.get(sessions[0].id), 'mock output');
    });

    it('transitions to failed on runner error', async () => {
      runner.runImplementation = async (options) => {
        if (options.onPid) options.onPid(12345);
        return {
          hasOutput: false,
          totalBytesStreamed: 0,
          error: new Error('mock execution failure'),
        };
      };

      await assert.rejects(
        orchestrator.run({
          providerKey: 'mock-provider',
          command: 'review-in-memory',
          permissionProfile: 'default',
          inputContent: 'hello',
          cwd: tmpDir,
          home: tmpDir,
        }),
        /mock execution failure/
      );

      const sessions = Array.from(store.sessions.values());
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].status, 'failed');

      const logContent = await readFile(store.errorLogPath(sessions[0].id), 'utf8');
      assert.match(logContent, /mock execution failure/);
    });

    it('transitions to cancelled when external cancellation is triggered', async () => {
      let cancelPromise: Promise<void> | undefined;
      runner.runImplementation = async (options) => {
        if (options.onPid) options.onPid(12345);

        cancelPromise = installer.triggerCancel(options.sessionId);
        await cancelPromise;

        return {
          hasOutput: false,
          totalBytesStreamed: 0,
        };
      };

      await assert.rejects(
        orchestrator.run({
          providerKey: 'mock-provider',
          command: 'review-in-memory',
          permissionProfile: 'default',
          inputContent: 'hello',
          cwd: tmpDir,
          home: tmpDir,
        }),
        /cancelled/
      );

      await cancelPromise;

      const sessions = Array.from(store.sessions.values());
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].status, 'cancelled');
    });

    it('transitions to failed on timeout', async () => {
      runner.runImplementation = async (options) => {
        if (options.onPid) options.onPid(12345);
        return {
          hasOutput: false,
          totalBytesStreamed: 0,
          error: new Error('provider execution timed out'),
        };
      };

      await assert.rejects(
        orchestrator.run({
          providerKey: 'mock-provider',
          command: 'review-in-memory',
          permissionProfile: 'default',
          inputContent: 'hello',
          cwd: tmpDir,
          home: tmpDir,
          timeoutMs: 10,
        }),
        /timed out/
      );

      const sessions = Array.from(store.sessions.values());
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].status, 'failed');

      const logContent = await readFile(store.errorLogPath(sessions[0].id), 'utf8');
      assert.match(logContent, /timed out/);
    });

    it('transitions to failed when the runner rejects outright', async () => {
      runner.runImplementation = async (options) => {
        if (options.onPid) options.onPid(12345);
        throw new Error('mock runner rejection');
      };

      await assert.rejects(
        orchestrator.run({
          providerKey: 'mock-provider',
          command: 'review-in-memory',
          permissionProfile: 'default',
          inputContent: 'hello',
          cwd: tmpDir,
          home: tmpDir,
        }),
        /mock runner rejection/
      );

      const sessions = Array.from(store.sessions.values());
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].status, 'failed');

      const logContent = await readFile(store.errorLogPath(sessions[0].id), 'utf8');
      assert.match(logContent, /mock runner rejection/);
    });
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
