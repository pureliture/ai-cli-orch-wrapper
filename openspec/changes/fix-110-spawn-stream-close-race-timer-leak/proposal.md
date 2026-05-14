## Why

`spawn-stream.ts`의 `child.on('close', ...)` 핸들러가 `for await` 루프 완료 후에 등록되어, 프로세스가 루프 실행 중 종료되면 `close` 이벤트가 핸들러 등록 전에 발생한다. 결과적으로 `clearExecutionTimers()`가 호출되지 않아 `timeoutTimer`와 `forceKillTimer`가 프로세스 수명 이후에도 잔존한다.

## What Changes

- `close` 이벤트 핸들러를 `spawn()` 직후에 등록하고 결과를 `Promise`로 캡처한다.
- `for await` 루프 완료 후 해당 `Promise`를 `await`하여 종료 코드와 시그널을 처리한다.
- 경쟁 조건 없이 모든 프로세스 종료 경로에서 `close` 이벤트가 확실히 처리된다.

## Capabilities

### New Capabilities

- `spawn-stream-close-safety`: `spawnStream`이 프로세스 종료 시 `close` 이벤트를 항상 수신하도록 보장하는 동작 — `spawn()` 직후 핸들러를 등록하고 스트림 소비 후 `await`한다.

### Modified Capabilities

<!-- 기존 스펙 수준 요구사항 변경 없음 -->

## Impact

- **영향 파일**: `packages/wrapper/src/util/spawn-stream.ts` (line 84~98)
- **영향 범위**: 모든 provider가 사용하는 `spawnStream` 유틸리티. 외부 API 변경 없음.
- **하위 호환성**: 함수 시그니처 및 반환 타입 변경 없음.
- **리스크**: 낮음 — 이벤트 핸들러 등록 순서 변경만으로 동작 보장을 확보한다.
