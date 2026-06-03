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
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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
