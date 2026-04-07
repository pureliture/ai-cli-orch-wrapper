## ADDED Requirements

### Requirement: 릴리즈 워크플로우 분리
`.github/workflows/release.yml`은 main 브랜치 push 이벤트에서만 실행되어야 하며, PR CI 워크플로우와 분리되어야 한다. release.yml의 job은 브랜치 보호 필수 체크에 포함되어서는 안 된다.

#### Scenario: main 머지 후 자동 실행
- **WHEN** PR이 main에 머지되면
- **THEN** release.yml이 자동 실행되고 ci.yml과는 독립적으로 동작해야 한다

#### Scenario: PR 단계에서 릴리즈 job 미실행
- **WHEN** PR이 열려 있는 상태이면
- **THEN** release.yml의 changelog/publish job이 실행되지 않아야 한다

### Requirement: changelog 자동 생성
release-drafter GitHub App은 PR의 레이블을 기반으로 changelog를 자동 생성해야 한다. type:feature는 Features 섹션, type:bug는 Bug Fixes 섹션, type:chore는 Maintenance 섹션으로 분류된다.

#### Scenario: 레이블 기반 changelog 분류
- **WHEN** type:feature 레이블이 달린 PR이 main에 머지되면
- **THEN** release-drafter가 생성한 draft release에 해당 PR이 Features 섹션에 포함되어야 한다

### Requirement: changesets 기반 npm 버전 관리
changesets는 버전 bump의 유일한 결정권자여야 한다. semantic-release를 사용하지 않는다. `.changeset/*.md` 파일이 없으면 publish가 실행되지 않아야 한다.

#### Scenario: changeset 파일 있을 때 publish
- **WHEN** .changeset/ 디렉토리에 변경 파일이 있고 main에 머지되면
- **THEN** changesets가 package.json 버전을 bump하고 npm에 publish해야 한다

#### Scenario: changeset 파일 없을 때 skip
- **WHEN** .changeset/ 디렉토리에 변경 파일이 없으면
- **THEN** publish가 실행되지 않고 워크플로우가 성공으로 종료되어야 한다
