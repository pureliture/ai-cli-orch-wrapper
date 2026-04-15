## ADDED Requirements

### Requirement: Sentinel prefix 에 랜덤 식별자 suffix 추가

provider 가 stdout 으로 `ACO_META:` prefix 를 출력할 때 caller 가 오인하는 collision 을 방지하기 위해, sentinel prefix 에 매 실행마다 랜덤 식별자 suffix 를 추가한다.

> **참고**: "UUID" 가 아닌 "랜덤 식별자" 라고 명명. RFC 4122 UUID 가 아닌 `crypto/rand` 로 생성한 8 바이트 (64비트) 난수의 16진수 표현 (16 hex chars) 이다.

#### Scenario: Sentinel 생성
- **WHEN** aco 가 provider 실행을 시작하면
- **THEN** `crypto/rand` 를 사용하여 8 바이트 (64비트) 난수를 생성하고 16진수로 인코딩 (16 hex chars, 예: `a3f2b1c4d5e6f789`)
- **THEN** `crypto/rand` 읽기 실패 시 stderr 에 경고 출력 후 fallback 식별자 사용 안 함 (sentinel 없이 종료)

#### Scenario: Sentinel 출력
- **WHEN** provider 가 정상 종료하면
- **THEN** stdout 마지막 줄에 `ACO_META_<rid>: {"agent":"<agent-id>","provider":"<provider>","model":"<model>","exit_code":<n>,"duration_ms":<n>}` 출력
- **THEN** `<rid>` 는 16 hex chars 길이의 랜덤 식별자

#### Scenario: Caller 가 sentinel 파싱
- **WHEN** caller 가 aco stdout 을 수신하면
- **THEN** `^ACO_META_[a-f0-9]{16}:` 정규식으로 sentinel 식별 및 파싱
- **THEN** caller 는 식별자를 strip 하고 기존 `ACO_META:` 형식으로 변환하여 하위 호환 유지

#### Scenario: Provider collision 방지
- **WHEN** provider 가 우연히 `ACO_META_` 로 시작하는 줄을 출력하면
- **THEN** 16 hex chars 길이가 일치하지 않으므로 caller 가 sentinel 로 오인하지 않음

#### Scenario: 동시 실행 UUID 중복 없음
- **WHEN** 100개의 aco 인스턴스가 동시에 실행되면
- **THEN** 각 인스턴스의 랜덤 식별자가 모두 달라야 함 (충돌 확률 < 2^-64)

#### Scenario: 기존 caller 마이그레이션
- **WHEN** 기존 caller 가 구 `ACO_META:` 형식을 파싱하는 경우
- **THEN** caller 코드를 `^ACO_META_[a-f0-9]{16}:` 정규식으로 업데이트해야 함
- **THEN** 마이그레이션 기간 동안 fallback 으로 구 형식도 임시 지원 가능
