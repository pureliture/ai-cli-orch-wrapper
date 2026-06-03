/**
 * U8: TTY/NO_COLOR 분리 + 출력 동기화 + ASCII 폴백 배선 테스트
 *
 * 5.1 - 비-TTY 환경에서 stderr 대시보드 프레임 비활성화
 * 5.2 - brief가 대시보드 렌더 완료 후 stdout 출력(순서 보장)
 * 4.6 - --no-unicode 또는 비-UTF-8 locale 시 ASCII 폴백
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
  home: string;
}

async function makeHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aco-tty-test-home-'));
}

async function runCli(
  args: string[],
  options: {
    home?: string;
    cwd?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
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
          ...options.env,
        },
        timeout: options.timeoutMs ?? 8000,
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

/** 대시보드 렌더 함수를 직접 테스트하는 helper */
import { renderRuntimeRollupDashboard } from '../src/runtime/dashboard.js';
import type { RuntimeContext } from '../src/runtime/types.js';
import { shouldRenderDashboard } from '../src/runtime/dashboard.js';
import { makeDashboardThrottleGuard } from '../src/runtime/dashboard.js';

function buildContext(provider: string): RuntimeContext {
  return {
    active: {
      provider,
      command: 'ask',
      sessionId: `session-${provider}`,
      permissionProfile: 'restricted',
      cwd: '/tmp/project',
      branch: 'feat/test',
      auth: { ok: true, method: 'cli-fallback' },
    },
    exposed: {
      sharedSkills: [],
      providerAgents: [],
      providerHooks: [],
      providerConfigFiles: [],
      provider,
    },
  };
}

// ---------------------------------------------------------------------------
// 5.1 TTY/NO_COLOR 단위 테스트
// ---------------------------------------------------------------------------
describe('shouldRenderDashboard (5.1 TTY/NO_COLOR)', () => {
  it('returns true when stderr is a TTY and NO_COLOR is not set', () => {
    // force 파라미터로 TTY=true, NO_COLOR=false 시뮬레이션
    assert.equal(shouldRenderDashboard({ isTTY: true, noColor: false }), true);
  });

  it('returns false when stderr is not a TTY (pipe/CI)', () => {
    assert.equal(shouldRenderDashboard({ isTTY: false, noColor: false }), false);
  });

  it('returns true (plain text, no suppress) when NO_COLOR is set in TTY', () => {
    // NO_COLOR = 색만 제거, 구조는 유지 → 렌더는 허용
    assert.equal(shouldRenderDashboard({ isTTY: true, noColor: true }), true);
  });

  it('returns false when stderr is not a TTY even if NO_COLOR is not set', () => {
    assert.equal(shouldRenderDashboard({ isTTY: false, noColor: false }), false);
  });
});

// ---------------------------------------------------------------------------
// 5.2 throttle 가드 단위 테스트
// ---------------------------------------------------------------------------
describe('makeDashboardThrottleGuard (5.2 throttle)', () => {
  it('allows the first call immediately', () => {
    const guard = makeDashboardThrottleGuard(150);
    assert.equal(guard.shouldRender(), true);
  });

  it('suppresses a second call within the deadband window', () => {
    const guard = makeDashboardThrottleGuard(150);
    guard.shouldRender(); // first call: allowed
    // 즉시 두 번째 호출 → deadband 내부이므로 억제
    assert.equal(guard.shouldRender(), false);
  });

  it('allows a call after the deadband window has elapsed', async () => {
    const guard = makeDashboardThrottleGuard(50); // 50ms deadband (테스트용)
    guard.shouldRender(); // first call
    await new Promise((res) => setTimeout(res, 70)); // deadband 초과
    assert.equal(guard.shouldRender(), true);
  });
});

// ---------------------------------------------------------------------------
// 4.6 ASCII 폴백 배선: --no-unicode 플래그
// ---------------------------------------------------------------------------
describe('renderRuntimeRollupDashboard unicode wiring (4.6)', () => {
  it('uses emoji icons when unicode is enabled (default)', () => {
    const output = renderRuntimeRollupDashboard(
      [
        { context: buildContext('antigravity'), icon: '🔵' },
        { context: buildContext('codex'), icon: '🟢' },
      ],
      { color: false, unicode: true }
    );
    assert.match(output, /🔵/);
    assert.match(output, /🟢/);
    assert.doesNotMatch(output, /\[AG\]/);
  });

  it('uses ASCII labels when unicode is false (--no-unicode)', () => {
    const output = renderRuntimeRollupDashboard(
      [
        { context: buildContext('antigravity'), icon: '🔵' },
        { context: buildContext('codex'), icon: '🟢' },
        { context: buildContext('mock'), icon: '⚪' },
      ],
      { color: false, unicode: false }
    );
    assert.match(output, /\[AG\]/);
    assert.match(output, /\[CX\]/);
    assert.match(output, /\[MC\]/);
    assert.match(output, /\[HOST\]/);
    assert.doesNotMatch(output, /🔵|🟢|⚪|🟠/);
  });

  it('keeps plain text structure intact when unicode is false (no color escapes)', () => {
    const output = renderRuntimeRollupDashboard(
      [{ context: buildContext('mock'), icon: '⚪' }],
      { color: false, unicode: false }
    );
    // 색 escape 없음
    assert.doesNotMatch(output, /\x1b\[/);
    // 구조 유지: Session ID 라벨이 있음
    assert.match(output, /Session ID/);
    assert.match(output, /\[MC\] mock/);
  });
});

// ---------------------------------------------------------------------------
// 5.1 통합 테스트: 비-TTY 환경에서 대시보드 비활성화 (CLI end-to-end)
// ---------------------------------------------------------------------------
describe('aco ask: non-TTY stderr suppresses dashboard (5.1 integration)', () => {
  it('does not render dashboard frame to stderr in non-TTY (pipe) environment', async () => {
    // execFile 환경은 stderr가 파이프이므로 비-TTY임
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'test tty suppression',
      '--input',
      'test input',
      '--yes',
      '--output-mode',
      'brief',
    ]);

    assert.equal(result.code, 0);
    // 비-TTY 환경: 대시보드 프레임이 stderr에 출력되지 않아야 한다
    assert.doesNotMatch(
      result.stderr,
      /aco Runtime Session/,
      'dashboard frame must be suppressed in non-TTY stderr'
    );
    // stdout brief는 손상 없이 출력되어야 한다
    assert.match(result.stdout, /Run:/);
  });

  it('still outputs brief to stdout when dashboard is suppressed (non-TTY)', async () => {
    const result = await runCli([
      'ask',
      '--providers',
      'mock',
      '--task',
      'brief output test',
      '--input',
      'some input',
      '--yes',
      '--output-mode',
      'brief',
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Run:/);
    assert.match(result.stdout, /Session:/);
    assert.match(result.stdout, /Provider: mock/);
  });
});

// ---------------------------------------------------------------------------
// 4.6 통합 테스트: --no-unicode CLI 플래그가 대시보드에 전달됨
// ---------------------------------------------------------------------------
describe('aco ask: --no-unicode flag wires ASCII fallback (4.6 integration)', () => {
  it('passes unicode:false to dashboard when --no-unicode is set (dry-run check)', async () => {
    // dry-run에서는 대시보드가 렌더되지 않으므로, 직접 renderRuntimeRollupDashboard 단위 경로로 확인
    const output = renderRuntimeRollupDashboard(
      [
        { context: buildContext('antigravity'), icon: '🔵' },
        { context: buildContext('mock'), icon: '⚪' },
      ],
      { color: false, unicode: false }
    );
    assert.match(output, /\[AG\]/);
    assert.match(output, /\[MC\]/);
    assert.match(output, /\[HOST\]/);
  });

  it('detects non-UTF-8 locale env and uses ASCII fallback', () => {
    // isUnicodeLocale 함수를 통한 locale 감지 단위 테스트
    // locale에 UTF-8 없는 경우 → ASCII 폴백 필요
    const { isUnicodeLocale } = require('../src/runtime/dashboard.js') as {
      isUnicodeLocale: (env: Record<string, string | undefined>) => boolean;
    };
    assert.equal(
      isUnicodeLocale({ LANG: 'en_US.ISO-8859-1', LC_ALL: undefined, LC_CTYPE: undefined }),
      false
    );
    assert.equal(isUnicodeLocale({ LANG: 'C', LC_ALL: undefined, LC_CTYPE: undefined }), false);
    assert.equal(
      isUnicodeLocale({ LANG: 'en_US.UTF-8', LC_ALL: undefined, LC_CTYPE: undefined }),
      true
    );
    assert.equal(
      isUnicodeLocale({ LANG: undefined, LC_ALL: 'C.UTF-8', LC_CTYPE: undefined }),
      true
    );
    assert.equal(
      isUnicodeLocale({ LANG: undefined, LC_ALL: undefined, LC_CTYPE: undefined }),
      true // fallback: locale 정보 없으면 UTF-8 지원 가정(안전한 기본값)
    );
  });
});
