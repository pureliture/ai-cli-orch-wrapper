## ADDED Requirements

### Requirement: /pm-triage 명령어
`.claude/commands/pm-triage.md`는 레이블이 없는 이슈를 `gh` CLI로 조회하고, Claude가 각 이슈의 제목과 본문을 분석해 type/area/priority 레이블을 제안하는 인터랙티브 분류 흐름을 제공해야 한다.

#### Scenario: 미분류 이슈 목록 표시
- **WHEN** `/pm-triage`를 실행하면
- **THEN** type:* 레이블이 없는 이슈 목록이 번호와 제목과 함께 표시되어야 한다

#### Scenario: 레이블 제안 및 적용
- **WHEN** Claude가 이슈 내용을 분석하면
- **THEN** 적절한 type/area/priority 레이블 조합을 제안하고, 사용자 확인 후 `gh issue edit`으로 적용해야 한다

### Requirement: /pm-status 명령어
`.claude/commands/pm-status.md`는 GitHub Projects V2 현재 스프린트의 이슈 상태를 `gh` CLI로 조회하고, Status별 이슈 수와 blocked 항목을 요약해 표시해야 한다.

#### Scenario: 스프린트 현황 요약
- **WHEN** `/pm-status`를 실행하면
- **THEN** 현재 Iteration의 Backlog/Ready/In Progress/In Review/Done 각 상태별 이슈 수와 status:blocked 이슈 목록이 표시되어야 한다
