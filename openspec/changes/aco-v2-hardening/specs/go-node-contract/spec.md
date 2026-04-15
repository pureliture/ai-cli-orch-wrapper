## ADDED Requirements

### Requirement: Go/Node.js 계약 경계 명세

Go wrapper (`cmd/aco/`) 와 Node.js wrapper (`packages/wrapper/`) 간의 책임 경계를 명시하여 drift 를 방지한다.

#### Scenario: Go validation 책임
- **WHEN** aco binary 가 실행되면
- **THEN** 다음을 검증: frontmatter parsing, formatter routing, CLI flag validation, provider binary exec, 파일 경로 검증 (`path/filepath.Clean()`, `..` 방지)

#### Scenario: Node.js wrapper 책임
- **WHEN** Node.js wrapper 가 호출되면
- **THEN** 다음을 담당: provider runtime 구현 (`IProvider`), session store, slash command dispatch, provider registry

#### Scenario: IProvider interface 준수
- **WHEN** 새 provider 를 추가하면
- **THEN** Go 측 `internal/provider/interface.go` 의 `IProvider` interface 와 Node.js 측 `IProvider` interface 모두 준수

#### Scenario: Contract drift 검증
- **WHEN** CI 가 실행되면
- **THEN** 공유 TypeScript 정의 파일 기준으로 Go/Node.js 양쪽 구현 검증
- **THEN** 인터페이스 메서드 시그니처 일관성 자동 확인

#### Scenario: 환경 변수 화이트리스트
- **WHEN** aco 가 provider 를 실행할 때
- **THEN** `ACO_TIMEOUT_SECONDS` 만 허용하고, 민감한 환경 변수 노출 방지
