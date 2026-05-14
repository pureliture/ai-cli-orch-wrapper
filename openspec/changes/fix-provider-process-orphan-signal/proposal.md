## Why

PR #108이 `spawn-stream.ts`에 `detached: process.platform !== 'win32'`를 도입하면서 Unix에서 프로바이더 CLI가 별도 프로세스 그룹으로 분리된다. `cli.ts`의 `cmdRun`에는 SIGINT/SIGTERM 포워딩 경로가 없어 `aco run` 종료(Ctrl+C 포함) 후에도 프로바이더 프로세스가 고아 상태로 계속 실행될 수 있다. PR #108이 프로세스 그룹 킬 유틸리티(`terminateProviderProcess`)를 timeout 경로에만 연결했고 인터랙티브 종료 경로는 연결하지 않은 것이 직접 원인이다.

## What Changes

- `packages/wrapper/src/runtime/provider-process.ts` 신규 생성 — `terminateProviderProcess(pid, signal)` 유틸리티. Unix에서는 `-pid` (process group) 킬을 먼저 시도하고 실패 시 `pid` 직접 킬로 폴백한다. PR #108과 동일한 구현으로 merge 충돌을 방지한다.
- `packages/wrapper/src/runtime/provider-session-runner.ts` 수정 — `ProviderSessionRunOptions`에 `onPid?: (pid: number) => void` 추가. runner 내부에서 세션 스토어 업데이트와 함께 호출한다.
- `packages/wrapper/src/cli.ts` 수정 — `cmdRun`에서 활성 provider PID를 클로저 변수로 추적하고, 세션이 실행 중인 동안 SIGINT/SIGTERM 핸들러를 등록해 `terminateProviderProcess`를 호출한다. 세션 종료 후 핸들러를 제거한다.

## Capabilities

### New Capabilities

- `provider-process-lifecycle`: `aco run` 실행 중 SIGINT/SIGTERM 수신 시 활성 프로바이더 프로세스(그룹)를 신뢰할 수 있게 종료하는 경로

### Modified Capabilities

(없음)

## Impact

- 영향 파일: `packages/wrapper/src/cli.ts`, `packages/wrapper/src/runtime/provider-session-runner.ts`
- 신규 파일: `packages/wrapper/src/runtime/provider-process.ts`
- PR #108과 merge 순서에 관계없이 충돌 없이 통합 가능하도록 `terminateProviderProcess` 구현을 동일하게 유지한다.
- 기존 public API 변경 없음. `ProviderSessionRunOptions`에 선택적 `onPid` 필드 추가만 있으므로 하위 호환성 유지.
