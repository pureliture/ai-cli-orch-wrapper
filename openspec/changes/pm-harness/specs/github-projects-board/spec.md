## ADDED Requirements

### Requirement: Projects V2 필드 구성
GitHub Projects V2 보드는 Status, Priority, Size, Sprint(Iteration), Target date 5개 필드를 가져야 한다. Status는 워크플로우 상태를, 레이블은 영속적 분류를 담당하며 중복하지 않는다.

#### Scenario: Status 필드 5단계
- **WHEN** Projects V2 보드를 조회하면
- **THEN** Status 필드에 Backlog, Ready, In Progress, In Review, Done 5개 옵션이 존재해야 한다

#### Scenario: 레이블과 Status 역할 분리
- **WHEN** 이슈의 상태가 변경될 때
- **THEN** Projects Status 필드를 업데이트하며, status:blocked를 제외한 상태 레이블은 사용하지 않아야 한다

### Requirement: 3종 보드 뷰
보드는 Active Sprint(Board), Triage(Table), Roadmap(Table/Gantt) 3종 뷰를 제공해야 한다.

#### Scenario: Active Sprint 뷰 필터
- **WHEN** Active Sprint 뷰를 열면
- **THEN** 현재 Iteration으로 필터링된 이슈가 Status 기준으로 컬럼 그룹핑되어 표시되어야 한다

#### Scenario: Triage 뷰 필터
- **WHEN** Triage 뷰를 열면
- **THEN** Iteration 미할당이거나 레이블 미할당 이슈가 테이블 형태로 표시되어야 한다
