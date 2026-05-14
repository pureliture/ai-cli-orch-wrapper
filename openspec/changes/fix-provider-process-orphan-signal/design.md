## Context

`aco run`은 `invokeProviderForSession`을 통해 프로바이더 CLI(codex, gemini 등)를 child process로 실행한다. 현재 `cmdRun`은 세션이 실행 중인 동안 SIGINT/SIGTERM 핸들러를 등록하지 않는다. PR #108이 `spawn-stream.ts`에 `detached: process.platform !== 'win32'`를 추가하면 Unix에서 프로바이더가 별도 프로세스 그룹이 되어 터미널 신호(Ctrl+C)가 자동으로 전파되지 않는다. 결과적으로 `aco run` 종료 후에도 프로바이더 프로세스가 고아 상태로 남는다.

현재 PID는 `sessionStore`에 기록되지만, `cmdRun`에서 이를 활성 신호 전달에 활용하지 않는다.

## Goals / Non-Goals

**Goals:**
- `aco run`이 종료(SIGINT/SIGTERM)될 때 활성 프로바이더 프로세스(그룹)도 함께 종료한다.
- `detached: true`(PR #108 이후)와 `detached: false`(현재) 모두에서 동작한다.
- PR #108의 `terminateProviderProcess`와 동일한 구현을 사전에 도입하여 merge 충돌을 예방한다.

**Non-Goals:**
- `aco ask` 경로의 신호 전달 (별도 이슈로 분리)
- `spawn-stream.ts`에서 `detached` 옵션 자체를 변경하거나 제거하는 것
- timeout/killGrace 경로 변경 (PR #108 범위)

## Decisions

**D1: `terminateProviderProcess` 유틸리티 사전 도입**

PR #108에서 동일한 함수를 도입 예정이므로, 이 fix에서 먼저 동일하게 구현한다. 두 PR이 merge될 때 중복이 되면 한쪽을 reuse하면 되고, 실질적 충돌 없이 통합된다.

대안으로 검토한 것: `provider-process.ts` 없이 `cli.ts` 내에 인라인 구현 → 코드 중복 유발, 재사용 어려움.

**D2: PID 추적을 위한 `onPid` 콜백을 `ProviderSessionRunOptions`에 추가**

`invokeProviderForSession` 안에서 이미 `provider.invoke`에 `onPid`를 전달하고 있다. 여기에 `ProviderSessionRunOptions`에 선택적 `onPid`를 추가하여 `cmdRun`의 클로저 변수로 PID를 동기적으로 캡처한다.

대안으로 검토한 것: 신호 수신 시 `sessionStore`에서 비동기 PID 읽기 → 신호 핸들러 내 async/await 불확실성, 신호 도착 시점에 아직 PID 미기록 가능성.

**D3: SIGINT/SIGTERM 핸들러를 `cmdRun` 내에서 등록/해제**

세션 시작 직전 핸들러를 등록하고, `invokeProviderForSession` 반환 후 `process.off`로 즉시 해제한다. Node.js는 SIGINT/SIGTERM 핸들러가 등록되면 기본 동작(process 종료)을 억제하므로 핸들러 내에서 `process.exit(1)`을 명시 호출한다.

## Risks / Trade-offs

- `process.kill(-pid, signal)` 실패 시(ESRCH 등) 폴백을 사용하지만, 프로세스가 이미 종료된 경우 조용히 무시한다. → `try/catch`로 흡수.
- PID가 재사용될 수 있는 race condition 가능성이 있으나, 세션 수명이 짧아 실제 위험이 낮다. → 주석으로 명시.
- SIGINT 핸들러에서 `process.exit(1)` 호출이 일부 cleanup hook을 건너뛸 수 있다. → 현재 cleanup이 없으므로 허용.

## Migration Plan

1. `provider-process.ts` 신규 생성.
2. `provider-session-runner.ts`에 `onPid` 추가 (선택적 필드, 기존 코드 영향 없음).
3. `cli.ts` `cmdRun`에 신호 핸들러 등록/해제 추가.
4. `npm test` + `npm run typecheck`로 검증.

롤백: 3개 변경을 revert — 세션 스토어 계약이나 API에 영향 없음.
