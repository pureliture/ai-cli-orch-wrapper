/**
 * permission-profile-policy.test.ts
 *
 * U4 TDD: permission-profile 전파·미지원 차단·최소 컨텍스트·실패 취소 정책
 *
 * 2.7 permission-profile 전파 + 미지원 provider 차단
 * 2.8 최소 컨텍스트 전달 — diff/branch 강제 수집 없음
 * 2.9 실패·취소 정책 — SIGINT 시 provider 프로세스 안전 종료
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';
import { Writable } from 'node:stream';
import { AntigravityProvider } from '../src/providers/antigravity';
import { CodexProvider } from '../src/providers/codex';
import { MockProvider } from '../src/providers/mock';
import type { IProvider, InvokeOptions, PermissionProfile } from '../src/providers/interface';
import { invokeProviderForSession } from '../src/runtime/provider-session-runner';
import { SessionStore } from '../src/session/store';
import { checkProviderProfileSupport } from '../src/runtime/provider-profile-guard';
import { terminateProviderProcess } from '../src/runtime/provider-process';
import { resolveProvidersForAsk } from '../src/commands/ask';
import {
  createProviderCancellationHandler,
  installProviderCancellationHandler,
  type ProviderCancellationState,
} from '../src/runtime/provider-cancellation';
import { ProviderRegistry } from '../src/providers/registry';

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aco-perm-profile-test-'));
}

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
  home: string;
}

async function runCli(
  args: string[],
  options: {
    home?: string;
    cwd?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
    pathPrefix?: string;
  } = {}
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
          ...(options.pathPrefix
            ? { PATH: `${options.pathPrefix}${delimiter}${process.env.PATH ?? ''}` }
            : {}),
          ...options.env,
        },
        timeout: options.timeoutMs ?? 8_000,
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code ?? 1
            : error
              ? 1
              : 0;
        resolveResult({ code, stdout, stderr, home });
      }
    );
  });
}

async function latestRunId(home: string): Promise<string> {
  const entries = await readdir(join(home, '.aco', 'runs'));
  assert.equal(entries.length, 1);
  return entries[0];
}

// ── 2.7 permission-profile 전파: buildArgs가 프로필을 실제로 반영 ──────────────

describe('permission-profile 전파 — buildArgs가 프로필을 반영한다', () => {
  it('AntigravityProvider: restricted 프로필은 --dangerously-skip-permissions를 생략한다', () => {
    const provider = new AntigravityProvider();
    const args = provider.buildArgs('ask', { permissionProfile: 'restricted' });
    assert.ok(
      !args.includes('--dangerously-skip-permissions'),
      `restricted profile must NOT include --dangerously-skip-permissions. Got: ${args.join(' ')}`
    );
    assert.ok(args.includes('-p'), `args must include -p flag. Got: ${args.join(' ')}`);
  });

  it('AntigravityProvider: unrestricted 프로필은 --dangerously-skip-permissions를 포함한다', () => {
    const provider = new AntigravityProvider();
    const args = provider.buildArgs('ask', { permissionProfile: 'unrestricted' });
    assert.ok(
      args.includes('--dangerously-skip-permissions'),
      `unrestricted profile must include --dangerously-skip-permissions. Got: ${args.join(' ')}`
    );
  });

  it('AntigravityProvider: default 프로필은 --dangerously-skip-permissions를 포함한다', () => {
    const provider = new AntigravityProvider();
    const args = provider.buildArgs('ask', { permissionProfile: 'default' });
    assert.ok(
      args.includes('--dangerously-skip-permissions'),
      `default profile must include --dangerously-skip-permissions. Got: ${args.join(' ')}`
    );
  });

  it('CodexProvider: restricted 프로필은 --full-auto를 생략한다', () => {
    const provider = new CodexProvider();
    const args = provider.buildArgs('ask', { permissionProfile: 'restricted' });
    assert.ok(
      !args.includes('--full-auto'),
      `restricted profile must NOT include --full-auto. Got: ${args.join(' ')}`
    );
    assert.ok(args.includes('exec'), `args must include exec subcommand. Got: ${args.join(' ')}`);
  });

  it('CodexProvider: unrestricted 프로필은 --full-auto를 포함한다', () => {
    const provider = new CodexProvider();
    const args = provider.buildArgs('ask', { permissionProfile: 'unrestricted' });
    assert.ok(
      args.includes('--full-auto'),
      `unrestricted profile must include --full-auto. Got: ${args.join(' ')}`
    );
  });

  it('invokeProviderForSession이 permissionProfile을 provider.invoke에 전달한다', async () => {
    // provider.invoke()가 받은 permissionProfile을 캡처하는 spy provider
    let capturedProfile: PermissionProfile | undefined;

    const spyProvider: IProvider = {
      key: 'spy',
      installHint: 'spy provider',
      icon: '⚪',
      isAvailable: () => true,
      async checkAuth() {
        return { ok: true, method: 'cli-fallback' as const };
      },
      buildArgs(_command: string, options?: InvokeOptions) {
        return ['spy', options?.permissionProfile ?? 'none'];
      },
      async *invoke(
        _command: string,
        _prompt: string,
        _content: string,
        options?: InvokeOptions
      ): AsyncIterable<string> {
        capturedProfile = options?.permissionProfile;
        yield 'spy output';
      },
    };

    const sessionDir = await mkdtemp(join(tmpdir(), 'aco-spy-session-'));
    const store = new SessionStore(sessionDir);
    const session = await store.create('spy', 'ask');
    const sink = new Writable({ write(_chunk, _enc, cb) { cb(); } });

    await invokeProviderForSession({
      provider: spyProvider,
      command: 'ask',
      prompt: 'test task',
      content: '',
      permissionProfile: 'restricted',
      sessionId: session.id,
      output: sink,
      store,
    });

    assert.equal(
      capturedProfile,
      'restricted',
      `provider.invoke must receive permissionProfile='restricted', got: ${String(capturedProfile)}`
    );

    await rm(sessionDir, { recursive: true, force: true });
  });
});

// ── 2.7 미지원 provider 차단 ──────────────────────────────────────────────────

describe('permission-profile 미지원 provider 차단', () => {
  it('supportsPermissionProfile()이 false를 반환하는 provider는 차단한다', () => {
    // provider가 특정 profile을 지원하지 않음을 명시적으로 선언한 경우
    const restrictedUnsupportedProvider: IProvider & {
      supportsPermissionProfile(profile: PermissionProfile): boolean;
    } = {
      key: 'unsupported-profile-provider',
      installHint: 'test only',
      icon: '⚪',
      isAvailable: () => true,
      async checkAuth() {
        return { ok: true, method: 'cli-fallback' as const };
      },
      buildArgs() {
        return [];
      },
      async *invoke(): AsyncIterable<string> {
        yield 'should not reach here';
      },
      // unrestricted 프로필만 지원하고 restricted는 차단하는 가상 provider
      supportsPermissionProfile(profile: PermissionProfile): boolean {
        return profile === 'unrestricted';
      },
    };

    assert.throws(
      () => checkProviderProfileSupport(restrictedUnsupportedProvider, 'restricted'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(
          err.message,
          /unsupported-profile-provider.*restricted/i,
          `Error must identify the provider and profile. Got: ${err.message}`
        );
        return true;
      },
      'checkProviderProfileSupport must throw for unsupported profile'
    );
  });

  it('supportsPermissionProfile이 없는 provider는 차단되지 않는다 (backward compat)', () => {
    const mock = new MockProvider();

    // MockProvider에는 supportsPermissionProfile이 없으므로 차단되지 않아야 함
    assert.doesNotThrow(
      () => checkProviderProfileSupport(mock, 'restricted'),
      'Provider without supportsPermissionProfile must not be blocked'
    );
  });

  it('supportsPermissionProfile()이 true를 반환하는 경우에는 차단하지 않는다', () => {
    const supportingProvider: IProvider & {
      supportsPermissionProfile(profile: PermissionProfile): boolean;
    } = {
      key: 'full-profile-provider',
      installHint: 'test only',
      icon: '⚪',
      isAvailable: () => true,
      async checkAuth() {
        return { ok: true, method: 'cli-fallback' as const };
      },
      buildArgs() {
        return [];
      },
      async *invoke(): AsyncIterable<string> {
        yield 'ok';
      },
      supportsPermissionProfile(_profile: PermissionProfile): boolean {
        return true;
      },
    };

    assert.doesNotThrow(
      () => checkProviderProfileSupport(supportingProvider, 'restricted'),
      'Provider that supports the profile must not be blocked'
    );
  });
});

// ── 2.7 미지원 차단 — 실제 ask resolveProviders 경로가 차단을 강제한다 ──────────
//
// Concern #1 fix: checkProviderProfileSupport가 ask.ts의 provider 해석 경로
// (resolveProvidersForAsk)에서 호출되어, 미지원 profile이면 명확한 에러로 차단된다.

describe('미지원 provider 차단 — ask 실제 경로(resolveProvidersForAsk)', () => {
  function makeRegistryWith(provider: IProvider): ProviderRegistry {
    const registry = new ProviderRegistry();
    registry.register(provider.key, provider);
    return registry;
  }

  it('resolveProvidersForAsk는 미지원 profile provider를 throw로 차단한다', () => {
    const restrictedUnsupported: IProvider & {
      supportsPermissionProfile(profile: PermissionProfile): boolean;
    } = {
      key: 'no-restricted',
      installHint: 'test only',
      icon: '⚪',
      isAvailable: () => true,
      async checkAuth() {
        return { ok: true, method: 'cli-fallback' as const };
      },
      buildArgs() {
        return [];
      },
      async *invoke(): AsyncIterable<string> {
        yield 'should not run';
      },
      supportsPermissionProfile(profile: PermissionProfile): boolean {
        return profile !== 'restricted';
      },
    };

    const registry = makeRegistryWith(restrictedUnsupported);

    assert.throws(
      () => resolveProvidersForAsk(['no-restricted'], 'restricted', registry),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(
          err.message,
          /no-restricted.*restricted/i,
          `Error must name provider and profile. Got: ${err.message}`
        );
        return true;
      },
      'resolveProvidersForAsk must block unsupported profile'
    );
  });

  it('resolveProvidersForAsk는 지원 profile은 통과시킨다', () => {
    const supported: IProvider & {
      supportsPermissionProfile(profile: PermissionProfile): boolean;
    } = {
      key: 'all-profiles',
      installHint: 'test only',
      icon: '⚪',
      isAvailable: () => true,
      async checkAuth() {
        return { ok: true, method: 'cli-fallback' as const };
      },
      buildArgs() {
        return [];
      },
      async *invoke(): AsyncIterable<string> {
        yield 'ok';
      },
      supportsPermissionProfile(): boolean {
        return true;
      },
    };

    const registry = makeRegistryWith(supported);

    assert.doesNotThrow(() => {
      const resolved = resolveProvidersForAsk(['all-profiles'], 'restricted', registry);
      assert.equal(resolved.length, 1);
      assert.equal(resolved[0].key, 'all-profiles');
    });
  });

  it('resolveProvidersForAsk는 supportsPermissionProfile 없는 provider를 통과시킨다 (backward compat)', () => {
    const registry = makeRegistryWith(new MockProvider());

    assert.doesNotThrow(() => {
      const resolved = resolveProvidersForAsk(['mock'], 'restricted', registry);
      assert.equal(resolved[0].key, 'mock');
    });
  });
});

// ── 2.8 최소 컨텍스트 전달 — diff/branch 강제 수집 없음 ──────────────────────

describe('최소 컨텍스트 — ask는 task 문자열만 전달하고 diff/branch를 강제 수집하지 않는다', () => {
  it('dry-run 출력에 diff/branch 관련 필드가 없다', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'minimal context test task',
      '--dry-run',
    ]);

    assert.equal(result.code, 0);
    assert.doesNotMatch(result.stdout, /git diff/i, 'dry-run must NOT mention git diff in output');
    assert.doesNotMatch(
      result.stdout,
      /git branch/i,
      'dry-run must NOT mention git branch in output'
    );
    assert.doesNotMatch(
      result.stdout,
      /diff_context/i,
      'dry-run must NOT include diff_context marshaling'
    );
  });

  it('ledger에 강제 diff/branch context 필드가 없다', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'minimal context ledger test',
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0);
    const runId = await latestRunId(result.home);
    const ledger = JSON.parse(
      await readFile(join(result.home, '.aco', 'runs', runId, 'ledger.json'), 'utf8')
    ) as Record<string, unknown>;

    assert.ok(!('forcedDiff' in ledger), 'ledger must NOT have forcedDiff field');
    assert.ok(!('diffContext' in ledger), 'ledger must NOT have diffContext field');
    assert.ok(!('branchContext' in ledger), 'ledger must NOT have branchContext field');

    // gitBranch/gitHead는 provenance 정보로 허용됨 (강제 marshaling이 아님)
    // 단, 이 값이 task prompt에 주입되지 않아야 함
    const sessions = ledger.sessions as Array<Record<string, unknown>>;
    const promptPath = join(
      result.home,
      '.aco',
      'sessions',
      sessions[0].id as string,
      'prompt.md'
    );
    const prompt = await readFile(promptPath, 'utf8');
    assert.doesNotMatch(prompt, /git diff/i, 'provider prompt must NOT contain injected git diff');
  });

  it('--task 없이 provider를 실행하면 에러를 반환한다 (task 필수)', async () => {
    const result = await runCli(['ask', '--providers', 'mock', '--yes']);

    assert.equal(result.code, 1);
    assert.match(
      result.stdout + result.stderr,
      /--task|--preset/,
      'must error when neither --task nor --preset is provided'
    );
  });
});

// ── 2.9 실패·취소 정책 ────────────────────────────────────────────────────────

describe('취소 정책 — provider 프로세스 안전 종료', () => {
  it('terminateProviderProcess: 유효하지 않은 PID는 false를 반환하고 throw하지 않는다', () => {
    // 존재하지 않는 PID에 대한 kill은 false를 반환해야 함 (에러를 던지지 않음)
    const result = terminateProviderProcess(-1, 'SIGTERM');
    assert.equal(result, false, 'terminateProviderProcess must return false for invalid PID');
  });

  it('terminateProviderProcess는 양의 정수 PID에만 동작한다', () => {
    assert.equal(terminateProviderProcess(0, 'SIGTERM'), false, 'PID 0 must return false');
    assert.equal(terminateProviderProcess(-5, 'SIGTERM'), false, 'negative PID must return false');
    assert.equal(
      terminateProviderProcess(1.5, 'SIGTERM'),
      false,
      'non-integer PID must return false'
    );
  });

  it('ask --yes로 실행된 mock provider 성공 시 exit code 0을 반환한다', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'cancellation policy test',
      '--yes',
      '--output-mode',
      'save-only',
    ]);

    assert.equal(result.code, 0, 'successful mock ask must exit 0');
  });

  it('provider 강제 실패 시 exit code 1을 반환한다', async () => {
    const result = await runCli(
      [
        'ask',
        '--providers',
        'mock',
        '--task',
        'forced failure policy test',
        '--yes',
        '--output-mode',
        'save-only',
      ],
      { env: { ACO_MOCK_FAIL: '1' } }
    );

    assert.equal(result.code, 1, 'forced failure must exit 1');
  });
});

// ── 2.9 취소 핸들러 — SIGINT/SIGTERM 수신 시 자식 정리·세션 cancelled ─────────
//
// Concern #2 fix: ask.ts에 signal 핸들러를 추가해, 사용자 취소 시 진행 중인 자식
// provider 프로세스를 terminateProviderProcess로 정리하고 세션을 cancelled로 기록한다.
// createProviderCancellationHandler를 seam으로 분리해 정리 경로가 호출됨을 단언한다.

describe('취소 핸들러 — createProviderCancellationHandler', () => {
  it('활성 PID가 있으면 SIGTERM으로 graceful 종료를 먼저 시도한다', () => {
    const terminated: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let cancelledSessionId: string | undefined;

    const state: ProviderCancellationState = { activePid: 4242, sessionId: 'sess-1' };
    const handler = createProviderCancellationHandler({
      state,
      terminate: (pid, signal) => {
        terminated.push({ pid, signal });
        return true;
      },
      markCancelled: async (sessionId) => {
        cancelledSessionId = sessionId;
      },
      exit: () => {
        /* exit를 막아 테스트가 끝까지 실행되도록 한다 */
      },
      // grace 타이머를 즉시 실행하지 않도록 no-op로 둔다 (SIGKILL escalation 분리 테스트).
      scheduleKill: () => undefined,
    });

    handler('SIGINT');

    // P1a: 받은 신호를 그대로 전파하지 않고 항상 SIGTERM(graceful)으로 먼저 종료한다.
    assert.equal(terminated.length, 1, 'terminate must be called once with SIGTERM');
    assert.equal(terminated[0].pid, 4242, 'terminate must target the active PID');
    assert.equal(
      terminated[0].signal,
      'SIGTERM',
      'graceful termination must send SIGTERM first, not the raw signal'
    );

    return new Promise<void>((resolveDone) => {
      setImmediate(() => {
        assert.equal(
          cancelledSessionId,
          'sess-1',
          'markCancelled must be called with the active session id'
        );
        resolveDone();
      });
    });
  });

  it('graceful 종료 후에도 자식이 살아있으면 SIGKILL로 escalate한다', () => {
    const terminated: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let scheduledDelay: number | undefined;
    let killCallback: (() => void) | undefined;

    const state: ProviderCancellationState = { activePid: 7777, sessionId: 'sess-kill' };
    const handler = createProviderCancellationHandler({
      state,
      terminate: (pid, signal) => {
        terminated.push({ pid, signal });
        return true;
      },
      markCancelled: async () => {},
      exit: () => {},
      killGraceMs: 1234,
      // SIGKILL escalation 타이머를 캡처해 수동으로 발화시킨다.
      scheduleKill: (cb, delayMs) => {
        killCallback = cb;
        scheduledDelay = delayMs;
        return undefined;
      },
    });

    handler('SIGINT');

    // 1차: SIGTERM
    assert.deepEqual(terminated[0], { pid: 7777, signal: 'SIGTERM' });
    assert.equal(scheduledDelay, 1234, 'kill escalation must use killGraceMs');

    // grace 만료 시뮬레이션
    assert.ok(killCallback, 'kill escalation callback must be scheduled');
    killCallback?.();

    // 2차: SIGKILL
    assert.deepEqual(
      terminated[1],
      { pid: 7777, signal: 'SIGKILL' },
      'after grace, terminate must escalate to SIGKILL'
    );
  });

  it('활성 PID가 없으면 terminate를 호출하지 않지만 세션은 cancelled로 기록한다', () => {
    const terminated: number[] = [];
    let cancelledSessionId: string | undefined;

    const state: ProviderCancellationState = { activePid: undefined, sessionId: 'sess-2' };
    const handler = createProviderCancellationHandler({
      state,
      terminate: (pid) => {
        terminated.push(pid);
        return true;
      },
      markCancelled: async (sessionId) => {
        cancelledSessionId = sessionId;
      },
      exit: () => {},
      scheduleKill: () => undefined,
    });

    handler('SIGTERM');

    assert.equal(terminated.length, 0, 'terminate must not be called when no active PID');

    return new Promise<void>((resolveDone) => {
      setImmediate(() => {
        assert.equal(cancelledSessionId, 'sess-2', 'markCancelled must still record cancellation');
        resolveDone();
      });
    });
  });

  it('sessionId가 없으면 markCancelled를 호출하지 않는다 (실행 전 시그널)', () => {
    let markCalled = false;

    const state: ProviderCancellationState = { activePid: undefined, sessionId: undefined };
    const handler = createProviderCancellationHandler({
      state,
      terminate: () => true,
      markCancelled: async () => {
        markCalled = true;
      },
      exit: () => {},
      scheduleKill: () => undefined,
    });

    handler('SIGINT');

    return new Promise<void>((resolveDone) => {
      setImmediate(() => {
        assert.equal(markCalled, false, 'markCancelled must be skipped when no session exists');
        resolveDone();
      });
    });
  });

  // P1b: provider invoke 완료/실패 후 activePid가 리셋되면, 이후 신호가 stale PID를
  // 종료하지 않는다. cmdAsk의 inner finally가 state.activePid를 undefined로 만든 뒤
  // 같은 핸들러로 신호가 와도 terminate가 호출되지 않아야 한다.
  it('activePid가 리셋된 후 신호가 와도 stale PID를 종료하지 않는다', () => {
    const terminated: number[] = [];
    let cancelledSessionId: string | undefined;

    // 멀티 provider 순차 실행을 흉내낸다: 첫 provider 실행 중 PID가 잡혔다가,
    // 완료 후 finally에서 activePid가 undefined로 리셋된 상태.
    const state: ProviderCancellationState = { activePid: 9999, sessionId: 'sess-A' };
    const handler = createProviderCancellationHandler({
      state,
      terminate: (pid) => {
        terminated.push(pid);
        return true;
      },
      markCancelled: async (sessionId) => {
        cancelledSessionId = sessionId;
      },
      exit: () => {},
      scheduleKill: () => undefined,
    });

    // provider 완료 후 finally가 activePid를 리셋한다 (P1b).
    state.activePid = undefined;
    // 다음 provider의 세션으로 갱신되었지만 아직 PID는 없는 구간에서 신호 수신.
    state.sessionId = 'sess-B';

    handler('SIGINT');

    assert.equal(terminated.length, 0, 'stale PID 9999 must NOT be terminated after reset');

    return new Promise<void>((resolveDone) => {
      setImmediate(() => {
        // 현재 세션(sess-B)은 여전히 cancelled로 기록되어야 한다.
        assert.equal(cancelledSessionId, 'sess-B', 'current session must still be cancelled');
        resolveDone();
      });
    });
  });
});

// ── P2a: register/cleanup 쌍 — installProviderCancellationHandler ─────────────
//
// signal listener가 루프/명령마다 누적되지 않도록 install/dispose 쌍을 제공한다.

describe('취소 핸들러 등록/해제 — installProviderCancellationHandler', () => {
  it('install은 SIGINT/SIGTERM 리스너를 등록하고 dispose는 해제한다', () => {
    const before = {
      sigint: process.listenerCount('SIGINT'),
      sigterm: process.listenerCount('SIGTERM'),
    };

    const state: ProviderCancellationState = { activePid: undefined, sessionId: undefined };
    const handle = installProviderCancellationHandler({
      state,
      markCancelled: async () => {},
      exit: () => {},
      scheduleKill: () => undefined,
    });

    assert.equal(
      process.listenerCount('SIGINT'),
      before.sigint + 1,
      'install must add exactly one SIGINT listener'
    );
    assert.equal(
      process.listenerCount('SIGTERM'),
      before.sigterm + 1,
      'install must add exactly one SIGTERM listener'
    );

    handle.dispose();

    assert.equal(
      process.listenerCount('SIGINT'),
      before.sigint,
      'dispose must remove the SIGINT listener'
    );
    assert.equal(
      process.listenerCount('SIGTERM'),
      before.sigterm,
      'dispose must remove the SIGTERM listener'
    );
  });

  it('dispose는 여러 번 호출해도 안전하다 (idempotent)', () => {
    const before = process.listenerCount('SIGINT');
    const state: ProviderCancellationState = { activePid: undefined, sessionId: undefined };
    const handle = installProviderCancellationHandler({
      state,
      markCancelled: async () => {},
      exit: () => {},
      scheduleKill: () => undefined,
    });

    handle.dispose();
    handle.dispose();

    assert.equal(
      process.listenerCount('SIGINT'),
      before,
      'repeated dispose must not corrupt listener count'
    );
  });
});

// ── 2.9 취소 통합 — aco ask가 SIGINT 시 자식 정리·세션 cancelled ──────────────
//
// Concern #2 통합 검증: 실제 `aco ask --yes` 프로세스를 spawn하고, provider 자식
// 프로세스가 뜬 뒤 SIGINT를 보내면 세션이 cancelled로 기록되고 프로세스가 종료된다.

describe('취소 통합 — aco ask SIGINT 시 세션 cancelled', () => {
  async function makeFakeAgyBin(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'aco-ask-cancel-bin-'));
    const body = [
      "if (process.argv.includes('--version')) {",
      "  process.stdout.write('agy-test 0.0.0\\n');",
      '  process.exit(0);',
      '}',
      "process.stdout.write('provider started\\n');",
      // SIGTERM 수신 시 잠시 후 종료 (안전 종료 경로 확인)
      "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 50));",
      'setInterval(() => {}, 1000);',
    ].join('\n');
    await writeFile(join(dir, 'agy'), `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
    return dir;
  }

  async function waitForAskSessionWithPid(
    home: string
  ): Promise<{ id: string; pid: number }> {
    // 전체 테스트 실행 시 시스템 부하로 Node.js + tsx 초기화가 4초를 초과하는 flake 방지.
    // 단독 실행 시 ~1-2초이므로 8초는 충분한 여유를 제공한다.
    const deadline = Date.now() + 8_000;
    const root = join(home, '.aco', 'sessions');
    while (Date.now() < deadline) {
      if (existsSync(root)) {
        const ids = await readdir(root);
        for (const id of ids) {
          try {
            const task = JSON.parse(
              await readFile(join(root, id, 'task.json'), 'utf8')
            ) as { pid?: unknown };
            if (typeof task.pid === 'number') return { id, pid: task.pid };
          } catch {
            /* task.json이 아직 안 써진 상태 — 재시도 */
          }
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('Timed out waiting for ask session PID');
  }

  it('SIGINT 수신 시 ask 세션을 cancelled로 기록하고 종료한다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'aco-ask-cancel-home-'));
    const binDir = await makeFakeAgyBin();
    const cliRoot = resolve(__dirname, '..');
    const cliPath = join(cliRoot, 'src', 'cli.ts');
    const tsxRegister = require.resolve('tsx/cjs');

    const child = spawn(
      process.execPath,
      [
        '--require',
        tsxRegister,
        cliPath,
        'ask',
        '--providers',
        'antigravity',
        '--task',
        'cancellation integration test',
        '--yes',
        '--output-mode',
        'save-only',
        '--timeout',
        '30',
      ],
      {
        cwd: cliRoot,
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          NO_COLOR: '1',
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    const { id } = await waitForAskSessionWithPid(home);
    child.kill('SIGINT');

    const exitCode = await new Promise<number | null>((resolveExit, rejectExit) => {
      const timer = setTimeout(() => rejectExit(new Error('aco ask did not exit after SIGINT')), 5_000);
      child.once('exit', (code) => {
        clearTimeout(timer);
        resolveExit(code);
      });
    });

    const task = JSON.parse(
      await readFile(join(home, '.aco', 'sessions', id, 'task.json'), 'utf8')
    ) as { status: string };

    assert.notEqual(exitCode, 0, 'cancelled ask must exit non-zero');
    assert.equal(task.status, 'cancelled', 'session must be marked cancelled on SIGINT');

    await rm(home, { recursive: true, force: true });
    await rm(binDir, { recursive: true, force: true });
  });

  // P2b: SIGTERM을 무시하는 자식이라도 부모가 SIGKILL escalation으로 정리한다.
  it('SIGTERM을 무시하는 자식도 SIGKILL fallback으로 정리하고 ask가 종료된다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'aco-ask-kill-home-'));
    const binDir = await mkdtemp(join(tmpdir(), 'aco-ask-kill-bin-'));
    // SIGTERM을 무시하는 fake agy: graceful 종료를 거부해 SIGKILL escalation을 강제한다.
    const body = [
      "if (process.argv.includes('--version')) {",
      "  process.stdout.write('agy-test 0.0.0\\n');",
      '  process.exit(0);',
      '}',
      "process.stdout.write('provider started\\n');",
      "process.on('SIGTERM', () => { /* ignore — force SIGKILL path */ });",
      'setInterval(() => {}, 1000);',
    ].join('\n');
    await writeFile(join(binDir, 'agy'), `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });

    const cliRoot = resolve(__dirname, '..');
    const cliPath = join(cliRoot, 'src', 'cli.ts');
    const tsxRegister = require.resolve('tsx/cjs');

    const child = spawn(
      process.execPath,
      [
        '--require',
        tsxRegister,
        cliPath,
        'ask',
        '--providers',
        'antigravity',
        '--task',
        'sigkill fallback test',
        '--yes',
        '--output-mode',
        'save-only',
        '--timeout',
        '30',
      ],
      {
        cwd: cliRoot,
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          NO_COLOR: '1',
          // 취소 시 SIGKILL escalation grace를 짧게 줘 테스트 시간 안에 발화시킨다.
          ACO_KILL_GRACE_MS: '300',
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    const { id, pid } = await waitForAskSessionWithPid(home);
    child.kill('SIGINT');

    const exitCode = await new Promise<number | null>((resolveExit, rejectExit) => {
      const timer = setTimeout(
        () => rejectExit(new Error('aco ask did not exit after SIGINT (SIGKILL path)')),
        8_000
      );
      child.once('exit', (code) => {
        clearTimeout(timer);
        resolveExit(code);
      });
    });

    const task = JSON.parse(
      await readFile(join(home, '.aco', 'sessions', id, 'task.json'), 'utf8')
    ) as { status: string };

    assert.notEqual(exitCode, 0, 'cancelled ask must exit non-zero even when child ignores SIGTERM');
    assert.equal(task.status, 'cancelled', 'session must be cancelled even on SIGKILL path');

    // 자식 프로세스 그룹이 실제로 정리되었는지 확인한다 (고아 leak 방지).
    // SIGKILL escalation 후 잠시 대기한 뒤 kill(pid, 0)으로 생존을 점검한다.
    await new Promise((r) => setTimeout(r, 500));
    let stillAlive = true;
    try {
      process.kill(pid, 0);
    } catch {
      stillAlive = false;
    }
    assert.equal(stillAlive, false, 'child must be killed (no orphan leak) after SIGKILL fallback');

    await rm(home, { recursive: true, force: true });
    await rm(binDir, { recursive: true, force: true });
  });
});

// ── 2.9 동시 호출 정책 명문화 (assertion 레벨) ────────────────────────────────

describe('동시 호출 정책 — /aco command 본문에 정책이 명시되어 있다', () => {
  it('aco.md에 동시 호출 정책 관련 설명이 포함되어 있다', async () => {
    const commandPath = resolve(__dirname, '..', '..', '..', '.claude', 'commands', 'aco.md');
    const content = await readFile(commandPath, 'utf8');

    // 동시 호출 정책: "중복" 또는 "동시" 또는 "concurrent" 또는 "parallel" 관련 내용
    const hasConcurrencyPolicy =
      content.includes('동시') ||
      content.includes('concurrent') ||
      content.includes('parallel') ||
      content.includes('중복') ||
      content.includes('one at a time') ||
      content.includes('sequential');

    assert.ok(hasConcurrencyPolicy, 'aco.md must document concurrency policy (동시 호출 정책)');
  });

  it('aco.md에 자연어 의도 해석 실패 시 비위임 안내가 포함되어 있다', async () => {
    const commandPath = resolve(__dirname, '..', '..', '..', '.claude', 'commands', 'aco.md');
    const content = await readFile(commandPath, 'utf8');

    // 의도 해석 실패 시 비위임 안내: 명확화 요청 또는 재입력 요청
    const hasFailurePolicy =
      content.includes('명확화') ||
      content.includes('clarif') ||
      content.includes('불명확') ||
      content.includes('cannot determine') ||
      content.includes('결정하지 못') ||
      content.includes('재입력') ||
      content.includes('provider') ||
      content.includes('Unauthenticated');

    assert.ok(
      hasFailurePolicy,
      'aco.md must document failure policy for unresolvable intent'
    );
  });
});
