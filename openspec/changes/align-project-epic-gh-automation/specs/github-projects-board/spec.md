## MODIFIED Requirements

### Requirement: Projects V2 필드 구성
GitHub Projects V2 board SHALL provide the Status, Priority, Size, Sprint(Iteration), and Target date fields, and the source of truth for epic relationships SHALL be the native GitHub `Parent issue`/`Sub-issue` relationship. Status and Priority SHALL live in Project fields, while labels SHALL remain the persistent classification layer without duplicating those fields.

#### Scenario: Status 필드 5단계
- **WHEN** Projects V2 보드를 조회하면
- **THEN** Status 필드에 Backlog, Ready, In Progress, In Review, Done 5개 옵션이 존재해야 한다

#### Scenario: 레이블과 Status 역할 분리
- **WHEN** 이슈의 상태가 변경될 때
- **THEN** Projects Status 필드를 업데이트하며, status:blocked를 제외한 상태 레이블은 사용하지 않아야 한다

#### Scenario: Epic 관계 source of truth
- **WHEN** epic과 child issue 관계를 해석할 때
- **THEN** system SHALL treat GitHub native `Parent issue`/`Sub-issue` relationship as the source of truth
- **AND** the custom Project `epic` field, if still present, SHALL be treated as unused or deprecated rather than authoritative

### Requirement: 3종 보드 뷰
The board SHALL provide the three views Active Sprint(Board), Triage(Table), and Roadmap(Table/Gantt), and `docs/pm-board.md` SHALL describe the same filter and grouping semantics that the actual Project uses.

#### Scenario: Active Sprint 뷰 필터
- **WHEN** Active Sprint 뷰를 열면
- **THEN** 현재 Iteration으로 필터링된 이슈가 Status 기준으로 컬럼 그룹핑되어 표시되어야 한다

#### Scenario: Triage 뷰 필터
- **WHEN** Triage 뷰를 열면
- **THEN** Iteration 미할당이거나 레이블 미할당인 이슈가 테이블 형태로 표시되어야 한다

#### Scenario: Roadmap 뷰 contract
- **WHEN** Roadmap 뷰를 열면
- **THEN** epic-tracking에 필요한 항목이 native parent/sub-issue 기준으로 표시되어야 한다
- **AND** the view configuration documented in `docs/pm-board.md` SHALL match the actual Project view semantics
