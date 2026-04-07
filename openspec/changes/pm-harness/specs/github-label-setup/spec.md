## ADDED Requirements

### Requirement: 레이블 체계 표준화
프로젝트는 GitHub Issues 레이블을 type/area/priority/status 네 가지 네임스페이스로 표준화된 체계로 관리해야 한다. 레이블은 `scripts/setup-github-labels.sh` 스크립트를 통해 일괄 생성 및 재적용할 수 있어야 한다.

#### Scenario: 레이블 일괄 생성
- **WHEN** `bash scripts/setup-github-labels.sh` 를 실행하면
- **THEN** type:epic, type:feature, type:task, type:bug, type:spike, type:chore, area:wrapper, area:installer, area:templates, area:ci, area:ops, p0, p1, p2, status:blocked 레이블이 저장소에 생성되어야 한다

#### Scenario: 중복 실행 안전성
- **WHEN** 이미 레이블이 존재하는 상태에서 스크립트를 재실행하면
- **THEN** 기존 레이블을 덮어쓰거나 색상/설명을 업데이트하되 오류 없이 완료되어야 한다

### Requirement: 레이블 색상 구분
각 네임스페이스는 시각적으로 구분 가능한 색상 그룹을 가져야 한다.

#### Scenario: 네임스페이스별 색상 그룹
- **WHEN** GitHub Issues 레이블 목록을 조회하면
- **THEN** type:* 레이블은 보라/파랑 계열, area:* 는 초록 계열, p0/p1/p2 는 빨강/주황/노랑 계열, status:blocked 는 회색으로 표시되어야 한다
