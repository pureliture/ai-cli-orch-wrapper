## ADDED Requirements

### Requirement: 단일 위임 진입점

시스템은 외부 AI 위임의 사용자向 진입점으로 Claude Code `/aco`와 Codex `$aco`만 SHALL 노출한다. `/antigravity:review`·`/antigravity:adversarial`·`/antigravity:rescue`와 `/review`·`/execute`·`/research`는 SHALL 배포하지 않는다.

#### Scenario: pack install 후 위임 진입점

- **WHEN** 사용자가 `aco pack install`(또는 `--global`)로 command pack을 설치한다
- **THEN** 설치된 위임 진입점은 `/aco`(및 Codex `$aco`)뿐이다
- **AND** `/antigravity:*`·`/review`·`/execute`·`/research` 커맨드 파일은 배포 산출물에 존재하지 않는다

#### Scenario: 제거된 커맨드 호출

- **WHEN** 사용자가 `/antigravity:review` 또는 `/review`를 호출하려 한다
- **THEN** 해당 커맨드는 존재하지 않으며, 위임은 `/aco`로만 가능하다

### Requirement: consent-gated 자연어 위임

`/aco`·`$aco`는 자연어 task를 받아 작업과 provider를 결정하고, 실행 계획을 먼저 제시한 뒤 사용자 동의가 있을 때에만 외부 provider를 SHALL 실행한다. 기본 출력 모드는 `brief`로 SHALL 한다.

#### Scenario: 계획 제시 후 미동의

- **WHEN** 사용자가 `/aco <자연어 작업>`을 실행한다
- **THEN** 시스템은 실행 계획(dry-run)을 제시하고 외부 provider를 호출하지 않는다
- **AND** 사용자가 동의하지 않으면 provider 실행은 일어나지 않는다

#### Scenario: 동의 후 실행

- **WHEN** 사용자가 제시된 계획에 동의한다
- **THEN** 시스템은 내부적으로 `aco ask --yes`를 실행하고 결과 요약(`brief`)을 반환한다

#### Scenario: 프롬프트에 provider 명시

- **WHEN** 사용자가 `/aco antigravity로 이 PR 리뷰해줘`처럼 provider를 자연어로 명시한다
- **THEN** 시스템은 명시된 provider로 위임을 고정한다

### Requirement: task-specific subcommand 금지

`/aco`·`$aco` 뒤에는 자연어 task만 SHALL 온다. `/aco status`·`/aco result`·`/aco cancel`·`/aco delegate` 같은 subcommand나 사용자向 flag 진입점을 SHALL 제공하지 않는다. 세션 운영(`aco status`/`result`/`cancel`)과 프롬프트 빌더(`aco delegate`)는 하부 CLI plumbing으로 SHALL 유지한다.

#### Scenario: subcommand 형태 미제공

- **WHEN** 사용자가 `/aco status` 형태로 호출하려 한다
- **THEN** `/aco`는 이를 자연어 task로 취급하며, `status`라는 스킬 subcommand는 존재하지 않는다
- **AND** 세션 상태 조회는 하부 CLI `aco status`로만 가능하다

### Requirement: provisioning 분리

위임 진입점은 provider 설치/인증(provisioning)을 SHALL 겸하지 않는다. provider가 미인증 상태이면 `/aco`는 setup 방법을 SHALL 안내한다.

#### Scenario: 미인증 provider 위임 시도

- **WHEN** 사용자가 미인증 provider로 `/aco` 위임을 시도한다
- **THEN** 시스템은 위임을 진행하지 않고 해당 provider의 setup 방법을 안내한다
