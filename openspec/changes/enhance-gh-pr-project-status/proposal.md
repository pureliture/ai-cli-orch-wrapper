## Why

`/gh-pr`와 `/gh-issue` 커맨드가 GitHub Projects 상태 관리와 priority 레이블 지정을 `pm-hook.sh` PostToolUse 훅에만 의존해 커맨드 템플릿 자체에는 보장이 없고, 훅 환경 변수(`PM_PROJECT_*`) 부재 시 조용히 실패한다.

## What Changes

- **Updated**: `/gh-pr` — PR 생성 후 PM Project 추가, PR 및 linked issue의 Status를 "In Review"로 설정, priority 레이블 상속/적용
- **Updated**: `/gh-issue` — 이슈 생성 시 priority 레이블(`p0`/`p1`/`p2`) 프롬프트 또는 추론 후 적용
- **Updated**: `scripts/pm-hook.sh` — 위 직접 처리의 idempotent fallback/safety-net 역할 명시
- **Updated**: `templates/commands/gh-pr.md` — 명시적 Project status 단계 추가
- **Updated**: `templates/commands/gh-issue.md` — priority 레이블 단계 추가

## Capabilities

### New Capabilities

- `gh-pr-project-status`: `/gh-pr` 실행 시 PR을 PM Project에 추가하고, PR 및 linked issue의 Project Status를 "In Review"로 설정하는 idempotent 처리 (실패 시 warn-not-fail)
- `gh-pr-priority-label`: `/gh-pr` 실행 시 linked issue의 priority 레이블을 PR에 상속, 없으면 `p1` 기본값 적용
- `gh-issue-priority-label`: `/gh-issue` 실행 시 `p0`/`p1`/`p2` priority 레이블을 생성 시점에 선택/추론해 적용

### Modified Capabilities

- `gh-pr-cmd`: Project status 관리 및 priority 레이블 상속 요구사항 추가
- `gh-issue-cmd`: priority 레이블 지정 요구사항 추가

## Impact

- `templates/commands/gh-pr.md` — Project status 단계 3개 추가 (PR add, PR status, issue status)
- `templates/commands/gh-issue.md` — priority 레이블 선택 단계 추가
- `scripts/pm-hook.sh` — fallback 역할 주석 명시 및 priority 상속 로직 추가
- GitHub Project #3 (`PVT_kwHOA6302M4BT5fA`) — `Status` field 및 `Priority` field ID 필요 (미설정 시 `setup-project-ids.sh`로 탐색)
- 의존성: `gh` CLI (인증), `PM_PROJECT_ID`, `PM_STATUS_FIELD_ID`, `PM_IN_REVIEW_OPTION_ID`, `PM_PRIORITY_FIELD_ID` 환경 변수
