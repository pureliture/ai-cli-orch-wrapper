## 1. 구현

- [x] 1.1 `spawn()` 직후 `closePromise`를 생성하고 `close`/`error` 핸들러를 등록한다
- [x] 1.2 `for await` 루프 이후 `await closePromise`로 종료 코드와 시그널을 처리한다
- [x] 1.3 기존 `new Promise<void>(...child.on('close', ...))` 블록을 제거한다

## 2. 테스트

- [x] 2.1 빠르게 종료되는 프로세스 시나리오에서 `close` 이벤트가 캡처됨을 검증하는 단위 테스트 추가
- [x] 2.2 exit code 0 정상 종료 시나리오 테스트
- [x] 2.3 exit code 1 이상 비정상 종료 시나리오 테스트
- [x] 2.4 시그널(`SIGKILL`) 종료 시나리오 테스트

## 3. 검증

- [x] 3.1 `npm run typecheck` 통과 확인
- [x] 3.2 `npm test` 통과 확인
- [x] 3.3 `aco run -- echo hello` 실행 후 타이머 누수 없음 확인
