## ADDED Requirements

### Requirement: close 이벤트 핸들러를 spawn 직후 등록
`spawnStream`은 `spawn()` 호출 직후, stdout 소비를 시작하기 전에 `child`의 `close` 이벤트 핸들러를 등록해야 한다. 등록된 핸들러는 프로세스 종료 코드와 시그널을 Promise로 캡처하고, stdout 소비 완료 후 해당 Promise를 `await`하여 결과를 처리해야 한다.

#### Scenario: 프로세스가 stdout 소비 전에 종료될 때 close 이벤트 수신
- **WHEN** 자식 프로세스가 stdout 데이터를 출력하고 `for await` 루프 실행 중에 종료되는 경우
- **THEN** `close` 이벤트가 핸들러 등록 이전에 발생하더라도 `closePromise`가 해당 이벤트를 캡처하여 종료 코드와 시그널이 정확히 처리된다

#### Scenario: 프로세스가 정상 종료될 때 close 이벤트 수신
- **WHEN** 자식 프로세스가 stdout을 모두 출력하고 exit code 0으로 종료되는 경우
- **THEN** `closePromise`가 `{ code: 0, signal: null }`로 resolve되고 `spawnStream`이 정상 완료된다

#### Scenario: 프로세스가 비정상 exit code로 종료될 때 에러 전파
- **WHEN** 자식 프로세스가 exit code 1 이상으로 종료되는 경우
- **THEN** `closePromise`가 resolve되고 종료 코드 기반의 에러 메시지를 포함한 `Error`가 throw된다

#### Scenario: 프로세스가 시그널로 종료될 때 에러 전파
- **WHEN** 자식 프로세스가 `SIGKILL` 등의 시그널에 의해 종료되는 경우
- **THEN** `closePromise`가 resolve되고 시그널 이름을 포함한 에러 메시지의 `Error`가 throw된다

### Requirement: error 이벤트를 closePromise에서 통합 처리
`spawnStream`은 `child.on('error', ...)` 핸들러를 `closePromise` 생성 시 함께 등록하여, spawn 실패 또는 프로세스 에러가 동일한 `await` 지점에서 reject로 전파되도록 해야 한다.

#### Scenario: spawn 에러 발생 시 reject 전파
- **WHEN** `child.on('error', ...)` 이벤트가 발생하는 경우
- **THEN** `closePromise`가 reject되어 `spawnStream` 호출자에게 에러가 전파된다
