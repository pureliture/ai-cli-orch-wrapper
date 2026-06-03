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

### Requirement: TTY/NO_COLOR 분리 대응

대시보드는 stderr로 렌더되며 stdout `brief` 출력을 SHALL 손상하지 않는다. 비-TTY(파이프/CI) 환경에서는 대시보드 렌더를 SHALL 비활성화한다(또는 주기적 1줄 요약 로거로 대체). `NO_COLOR`가 설정되면 색만 SHALL 제거하고 평문 대시보드 구조는 유지한다.

#### Scenario: 파이프(비-TTY) 출력

- **WHEN** `aco ask`의 출력을 파이프로 연결해 비-TTY로 실행한다
- **THEN** stderr 대시보드 프레임이 비활성화되고, stdout의 `brief` 요약은 손상 없이 그대로 전달된다

#### Scenario: NO_COLOR 설정

- **WHEN** `NO_COLOR`가 설정된 TTY에서 `aco ask`를 실행한다
- **THEN** 대시보드는 색 없이 평문으로 렌더되고 구조(헤더·provider 행)는 유지된다

### Requirement: 출력 동기화 및 갱신 throttle

stdout `brief`는 대시보드 렌더가 완료된 뒤 일괄 출력되어 stderr 대시보드와 화면에서 SHALL 충돌하지 않는다. 멀티세션 상태 갱신은 100~200ms throttle/deadband를 SHALL 적용해 flicker와 CPU 급증을 방지한다.

#### Scenario: brief와 대시보드 동시 활성

- **WHEN** 대시보드가 활성인 상태로 `aco ask`가 완료되어 `brief`를 출력한다
- **THEN** `brief`는 대시보드 렌더 완료 후 일괄 출력되어 프레임과 섞이지 않는다

#### Scenario: 잦은 상태 갱신

- **WHEN** 여러 provider 세션이 빈번히 상태를 갱신한다
- **THEN** 대시보드 재렌더는 100~200ms 간격으로 제한된다

### Requirement: provider 아이콘 ASCII 폴백

provider 아이콘은 `--no-unicode`가 설정되거나 비-UTF-8/유니코드 미지원 환경이 감지되면 ASCII 라벨(`[AG]`·`[CX]`·`[MC]`)로 SHALL 폴백한다.

#### Scenario: 비-UTF-8 환경

- **WHEN** `--no-unicode` 또는 비-UTF-8 locale에서 대시보드를 렌더한다
- **THEN** 색동그라미 이모지 대신 ASCII 라벨이 표시되고 행 정렬이 유지된다

### Requirement: 멀티프로바이더 부분 인증 실패 처리

멀티프로바이더 위임에서 일부 provider 인증이 실패하면, 시스템은 정의된 정책(전체 중단 또는 인증된 provider만 degraded 실행)에 따라 SHALL 동작하고, 대시보드에 실패 provider의 상태를 SHALL 표시한다.

#### Scenario: 일부 provider 인증 실패

- **WHEN** 두 provider 중 하나가 미인증 상태로 위임이 시작된다
- **THEN** 시스템은 정의된 정책(abort 또는 degraded)에 따라 동작하고, 대시보드는 해당 provider 행을 실패/미인증 상태로 표시한다
