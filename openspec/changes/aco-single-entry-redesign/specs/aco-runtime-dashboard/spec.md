## ADDED Requirements

### Requirement: 공통 커널 기반 ask 경로 대시보드

`renderRuntimeDashboard`와 `collectRuntimeContext`는 공통 `runtime/` 커널로 추출되어 `aco ask`와 `aco run`이 모두 SHALL 사용한다. `aco ask`(정본 `/aco` 경로) 실행 시 'aco Runtime Session' 대시보드를 SHALL 렌더한다. 커맨드 `aco ask`(선언적 멀티프로바이더)와 `aco run`(명령형 단일 provider)은 분리 상태로 SHALL 유지한다.

#### Scenario: /aco 실행 시 대시보드

- **WHEN** 사용자가 `/aco`에 동의해 내부적으로 `aco ask --yes`가 실행된다
- **THEN** 'aco Runtime Session' 대시보드가 stderr에 렌더된다

#### Scenario: aco run 회귀 없음

- **WHEN** `aco run <provider> <command>`를 실행한다
- **THEN** 기존과 동일한 런타임 대시보드가 렌더된다(커널 추출 후 회귀 없음)

### Requirement: 멀티프로바이더 롤업 렌더

여러 provider가 한 위임에 참여하면 대시보드는 공통 정보(command·branch)를 롤업 헤더로, 각 provider를 별도 행(session·auth)으로 SHALL 렌더한다. `collectRuntimeContext`는 단일 세션이 아닌 멀티 세션 모델을 SHALL 지원한다.

#### Scenario: 2개 이상 provider

- **WHEN** `/aco`가 antigravity와 codex 두 provider로 위임을 실행한다
- **THEN** 대시보드는 롤업 헤더 1개와 provider별 행 2개(각 session·auth)를 표시한다

### Requirement: provider 아이콘

`IProvider`는 `readonly icon` 필드를 SHALL 가진다. 대시보드는 각 provider 행 앞에 그 provider의 `icon`(색동그라미 이모지)을 SHALL 렌더한다. 신규 provider도 `icon`을 SHALL 지정한다.

#### Scenario: provider별 아이콘 표시

- **WHEN** 대시보드가 antigravity·codex·mock provider 행을 렌더한다
- **THEN** 각 행 앞에 지정된 색동그라미 이모지(antigravity 🔵 · codex 🟢 · mock ⚪)가 표시된다

### Requirement: TTY-aware 대시보드 억제

대시보드는 stderr로 렌더되며 stdout `brief` 출력을 SHALL 손상하지 않는다. 비-TTY 환경이거나 `NO_COLOR`가 설정되면 시스템은 대시보드를 억제하거나 평문 폴백을 SHALL 적용한다.

#### Scenario: 파이프(비-TTY) 출력

- **WHEN** `aco ask`의 출력을 파이프로 연결해 비-TTY로 실행한다
- **THEN** stderr 대시보드 프레임이 억제되거나 폴백되고, stdout의 `brief` 요약은 손상 없이 그대로 전달된다
