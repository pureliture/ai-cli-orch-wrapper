## ADDED Requirements

### Requirement: PR 게이트 CI 워크플로우
`.github/workflows/ci.yml` 은 pull_request와 push 이벤트에서 실행되며, lint → typecheck → test → smoke 순서로 4개 job을 실행해야 한다. smoke job은 `needs: [test]`로 test 완료 후 실행된다.

#### Scenario: PR 오픈 시 전체 CI 실행
- **WHEN** main 브랜치 대상 PR이 열리거나 새 커밋이 push되면
- **THEN** lint, typecheck, test, smoke 4개 job이 순서대로 실행되어야 한다

#### Scenario: CI 실패 시 머지 차단
- **WHEN** lint, typecheck, test, smoke 중 하나라도 실패하면
- **THEN** 해당 PR은 머지가 차단되어야 한다

### Requirement: 순차적 패키지 실행
typecheck와 test job은 packages/wrapper를 먼저, packages/installer를 나중에 순차 실행해야 한다. 병렬 매트릭스를 사용하지 않는다.

#### Scenario: wrapper 먼저 실행
- **WHEN** typecheck job이 실행되면
- **THEN** packages/wrapper의 tsc --noEmit가 완료된 후 packages/installer의 tsc --noEmit가 실행되어야 한다

### Requirement: smoke test 실제 설치 재현
smoke job은 `npm pack --workspaces`로 tgz를 생성한 후 실제 설치 경로를 재현해 `aco --version`과 `aco run --help`가 실행되어야 한다. dist/ 직접 실행은 허용되지 않는다.

#### Scenario: smoke test 성공
- **WHEN** smoke job이 실행되면
- **THEN** npm pack → 로컬 설치 → aco --version 실행이 0 exit code로 완료되어야 한다

#### Scenario: smoke test 실패 격리
- **WHEN** smoke job만 실패하고 test job은 통과한 경우
- **THEN** GitHub Actions UI에서 smoke job만 빨간불이 표시되어 실패 원인이 바이너리 패키징임을 즉시 식별할 수 있어야 한다
