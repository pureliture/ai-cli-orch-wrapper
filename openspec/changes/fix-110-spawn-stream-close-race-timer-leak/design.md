## Context

`packages/wrapper/src/util/spawn-stream.ts`의 `spawnStream` 함수는 자식 프로세스를 생성하고 stdout을 `AsyncIterable<string>`으로 yield한다. 현재 구조:

1. `spawn()` 호출
2. `for await (const chunk of child.stdout)` — stdout 소비
3. `new Promise<void>((resolve, reject) => { child.on('close', ...) })` 등록 및 await

`for await` 루프는 stdout 스트림이 닫힐 때 종료된다. stdout이 닫히는 시점과 프로세스 `close` 이벤트 발생 시점 사이에 gap이 있으며, 이 gap 동안 `close` 이벤트 핸들러가 아직 등록되지 않은 상태에서 이벤트가 발생할 수 있다. `EventEmitter`는 등록 전 발생한 이벤트를 재전달하지 않으므로 핸들러가 영구히 호출되지 않는다.

## Goals / Non-Goals

**Goals:**
- `spawnStream`이 모든 프로세스 종료 타이밍에서 `close` 이벤트를 반드시 수신하도록 보장한다.
- 함수 시그니처(`binary`, `args`, `config`, `options`), 반환 타입(`AsyncIterable<string>`), 에러 메시지 형식을 유지한다.

**Non-Goals:**
- 타이머 관리 로직 추가 — `clearExecutionTimers()` 등의 cleanup은 호출자(provider) 책임이다.
- `stderr` 수집 방식 변경.
- 재시도, 백오프, 프로세스 재시작 로직.

## Decisions

### Decision 1: `close` Promise를 `spawn()` 직후 생성

**선택**: `spawn()` 직후, `for await` 루프 이전에 `closePromise`를 생성하고 핸들러를 등록한다.

```typescript
const closePromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
  (resolve, reject) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
    child.on('error', reject);
  }
);

for await (const chunk of child.stdout) { ... }

const { code, signal } = await closePromise;
```

**대안 고려**: `child.on('close', ...)` 핸들러를 루프 전에 등록하고 변수에 저장하는 방식도 가능하지만, Promise로 캡처하면 `error` 이벤트와 `close` 이벤트를 단일 `await` 지점에서 처리할 수 있어 오류 전파가 명확하다.

**이유**: Node.js `EventEmitter`는 리스너 등록 전 발생한 이벤트를 재전달하지 않는다. 핸들러를 `spawn()` 직후 등록하면 경쟁 조건의 발생 가능성 자체를 제거한다.

### Decision 2: `error` 이벤트도 `closePromise`로 통합

기존 코드는 `close` Promise 내에서 `child.on('error', reject)`를 함께 등록했다. 이 구조를 `closePromise`로 이전하여 하나의 `await` 지점에서 `close`와 `error` 모두를 처리한다.

## Risks / Trade-offs

- **`stdout` 소비 중 `error` 이벤트 발생** → `for await` 루프가 예외를 던질 수 있고, `closePromise`가 reject 상태가 될 수 있다. `for await` 이후 `await closePromise`가 실행되지 않을 수 있지만, reject된 Promise는 GC에서 정리된다. 실질적 리스크 없음.
- **변경 범위 최소** → 함수 본문 내 `Promise` 생성 위치 이동과 `await` 구조 변경만으로 구성되므로 회귀 위험이 낮다.
- **테스트 커버리지** → 빠르게 종료되는 프로세스 시나리오를 단위 테스트로 추가해야 한다.

## Migration Plan

코드 변경 범위가 `spawnStream` 내부 구현에 한정되고 외부 인터페이스가 동일하므로 별도 마이그레이션 절차 없음. 단위 테스트로 회귀 검증 후 바로 배포 가능.
