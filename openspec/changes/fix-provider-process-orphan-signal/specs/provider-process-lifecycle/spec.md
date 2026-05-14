## ADDED Requirements

### Requirement: Signal forwarding during aco run
`aco run`이 실행 중인 동안 SIGINT 또는 SIGTERM을 수신하면, 활성 프로바이더 프로세스(그룹)에 해당 신호를 포워딩한 후 `aco run` 프로세스 자체도 종료되어야 한다.

#### Scenario: SIGINT received during active provider session
- **WHEN** `aco run`이 프로바이더를 실행 중인 상태에서 SIGINT(Ctrl+C)를 수신한다
- **THEN** 활성 프로바이더 PID(또는 프로세스 그룹)에 종료 신호가 전달되고, `aco run`은 exit code 1로 종료된다

#### Scenario: SIGTERM received during active provider session
- **WHEN** `aco run`이 프로바이더를 실행 중인 상태에서 SIGTERM을 수신한다
- **THEN** 활성 프로바이더 PID(또는 프로세스 그룹)에 종료 신호가 전달되고, `aco run`은 exit code 1로 종료된다

#### Scenario: Signal received before PID is available
- **WHEN** 프로바이더가 아직 PID를 보고하지 않은 상태에서 신호를 수신한다
- **THEN** `aco run`은 종료되며, PID가 없어도 프로세스 자체는 정상 종료된다

#### Scenario: Signal received after provider has already exited
- **WHEN** 프로바이더가 정상 종료된 후 신호 핸들러가 남아있는 상태에서 신호가 수신된다
- **THEN** 신호 전달 시도가 무시되고 `aco run`은 정상 종료된다

### Requirement: Process group kill compatibility
Unix 시스템에서 프로바이더 프로세스를 종료할 때, 프로세스 그룹 킬(`-pid`)을 먼저 시도하고 실패 시 직접 PID 킬로 폴백해야 한다.

#### Scenario: Provider spawned with detached process group (Unix)
- **WHEN** 프로바이더가 `detached: true`로 스폰된 경우 종료 신호가 전달된다
- **THEN** `process.kill(-pid, signal)`로 프로세스 그룹 전체가 종료된다

#### Scenario: Provider spawned without detached (Unix)
- **WHEN** 프로바이더가 `detached: false`(기본값)로 스폰된 경우 종료 신호가 전달된다
- **THEN** `-pid` 킬이 실패하면 `process.kill(pid, signal)`로 직접 프로세스를 종료한다

#### Scenario: Windows process termination
- **WHEN** Windows 환경에서 프로바이더 종료 신호가 전달된다
- **THEN** `process.kill(pid, signal)`이 직접 호출된다 (`-pid` 시도 없음)
