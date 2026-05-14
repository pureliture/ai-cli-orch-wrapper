## 1. provider-process 유틸리티 생성

- [x] 1.1 `packages/wrapper/src/runtime/provider-process.ts` 신규 생성 — `terminateProviderProcess(pid, signal)` 구현 (Unix: `-pid` 그룹 킬 우선, 폴백 직접 킬; Windows: 직접 킬)

## 2. ProviderSessionRunOptions에 onPid 추가

- [x] 2.1 `packages/wrapper/src/runtime/provider-session-runner.ts`의 `ProviderSessionRunOptions` 인터페이스에 `onPid?: (pid: number) => void` 필드 추가
- [x] 2.2 `invokeProviderForSession` 내부에서 기존 `sessionStore.update`와 함께 `options.onPid?.(pid)` 호출

## 3. cmdRun에 SIGINT/SIGTERM 핸들러 등록

- [x] 3.1 `packages/wrapper/src/cli.ts` `cmdRun`에서 `activePid: number | undefined` 클로저 변수 선언
- [x] 3.2 `invokeProviderForSession` 호출 옵션에 `onPid: (pid) => { activePid = pid; }` 추가
- [x] 3.3 세션 시작 전 SIGINT/SIGTERM 핸들러 등록 — `activePid`가 있으면 `terminateProviderProcess` 호출 후 `process.exit(1)`
- [x] 3.4 `invokeProviderForSession` 반환 후 `process.off`로 핸들러 해제

## 4. 검증

- [x] 4.1 `npm run typecheck --workspace=packages/wrapper` 통과 확인
- [x] 4.2 `npm test --workspace=packages/wrapper` 통과 확인
- [x] 4.3 메인 레포의 change 디렉토리(`openspec/changes/fix-provider-process-orphan-signal/`)에 artifacts 동기화
