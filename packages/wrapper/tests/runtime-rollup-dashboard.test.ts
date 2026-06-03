import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderRuntimeRollupDashboard } from '../src/runtime/dashboard.js';
import type { RuntimeContext } from '../src/runtime/types.js';

function buildContext(
  provider: string,
  overrides: Partial<RuntimeContext['active']> = {}
): RuntimeContext {
  return {
    active: {
      provider,
      command: 'ask',
      sessionId: `session-${provider}`,
      permissionProfile: 'restricted',
      cwd: '/tmp/project',
      branch: 'feat/161-aco-redesign',
      auth: { ok: true, method: 'cli-fallback' },
      ...overrides,
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

describe('renderRuntimeRollupDashboard', () => {
  it('renders a single rollup header and one row per provider (4.2)', () => {
    const output = renderRuntimeRollupDashboard(
      [
        { context: buildContext('antigravity'), icon: '🔵' },
        { context: buildContext('codex'), icon: '🟢' },
      ],
      { color: false }
    );

    // 롤업 헤더는 1번만(공통 command·branch).
    assert.equal(output.match(/aco Runtime Session/g)?.length, 1);
    // 공통 command·branch가 롤업 헤더에 표시된다.
    assert.match(output, /Command/);
    assert.match(output, /branch|Branch/i);
    assert.match(output, /feat\/161-aco-redesign/);
    // provider별 행 2개(각 session·auth).
    assert.match(output, /antigravity/);
    assert.match(output, /codex/);
    assert.match(output, /session-antigravity/);
    assert.match(output, /session-codex/);
  });

  it('renders the provider icon in front of each provider row (4.5)', () => {
    const output = renderRuntimeRollupDashboard(
      [
        { context: buildContext('antigravity'), icon: '🔵' },
        { context: buildContext('codex'), icon: '🟢' },
        { context: buildContext('mock'), icon: '⚪' },
      ],
      { color: false }
    );

    assert.match(output, /🔵/);
    assert.match(output, /🟢/);
    assert.match(output, /⚪/);
    // host 헤더는 🟠.
    assert.match(output, /🟠/);
  });

  it('falls back to ASCII labels when unicode is disabled (4.6)', () => {
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
    // 색동그라미·장식 이모지는 ASCII 폴백에서 등장하지 않는다.
    assert.doesNotMatch(output, /🔵|🟢|⚪|🟠|🛰️|⚠️/);
    // host 헤더는 ASCII 라벨로 폴백한다.
    assert.match(output, /\[HOST\]/);
    // 정렬 유지: 모든 provider 행이 동일한 들여쓰기 규약을 따른다.
    assert.match(output, /\[AG\] antigravity/);
    assert.match(output, /\[CX\] codex/);
    assert.match(output, /\[MC\] mock/);
  });

  it('marks an unauthenticated provider row as a failure (4.7)', () => {
    const output = renderRuntimeRollupDashboard(
      [
        { context: buildContext('codex'), icon: '🟢' },
        {
          context: buildContext('antigravity', {
            auth: { ok: false, method: 'missing', hint: 'agy login' },
          }),
          icon: '🔵',
        },
      ],
      { color: false }
    );

    // 미인증 provider 행은 not ready/실패 상태로 표시된다.
    assert.match(output, /not ready/);
    assert.match(output, /agy login/);
  });

  it('degraded 안내는 미인증 provider가 skip되고 인증된 provider로 계속됨을 정확히 설명한다', () => {
    const output = renderRuntimeRollupDashboard(
      [
        { context: buildContext('codex'), icon: '🟢' },
        {
          context: buildContext('antigravity', {
            auth: { ok: false, method: 'missing', hint: 'agy login' },
          }),
          icon: '🔵',
        },
      ],
      { color: false }
    );

    // 미인증 provider 이름이 표시된다.
    assert.match(output, /Not authenticated: antigravity/);
    // 정확한 degraded 정책: 미인증 provider는 skip되고, 인증된 provider로 run이 계속된다.
    assert.match(output, /skipped/);
    assert.match(output, /degraded mode/);
    assert.match(output, /authenticated providers/);
    // 논리 반대 문구("Authenticated providers run in degraded mode")는 더 이상 없어야 한다.
    assert.doesNotMatch(output, /Authenticated providers run in degraded mode/);
    // setup 안내가 유지된다.
    assert.match(output, /aco provider setup/);
  });

  it('keeps a single-provider rollup byte-compatible with one provider row', () => {
    const output = renderRuntimeRollupDashboard(
      [{ context: buildContext('mock'), icon: '⚪' }],
      { color: false }
    );

    assert.equal(output.match(/aco Runtime Session/g)?.length, 1);
    assert.match(output, /mock/);
    assert.match(output, /session-mock/);
  });
});
