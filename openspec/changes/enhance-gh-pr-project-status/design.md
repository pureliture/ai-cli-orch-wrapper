## Context

`add-gh-pm-workflow-commands` 에서 구현된 `/gh-pr`와 `/gh-issue`는 PR 생성과 이슈 생성의 기본 흐름만 다루고, Project 상태 관리와 priority 레이블 지정은 `scripts/pm-hook.sh` PostToolUse 훅에 위임한다. 훅은 `.claude` 세션 환경에서만 동작하며 `PM_PROJECT_*` 환경 변수가 없으면 조용히 실패한다. 커맨드 템플릿 자체만 보면 Project 연결 보장이 없다.

## Goals / Non-Goals

**Goals:**
- `/gh-pr` 템플릿이 PR 생성 후 직접 PM Project 추가 및 Status "In Review" 설정
- `/gh-pr` 템플릿이 `Closes #N` 등 linked issue의 Status도 직접 "In Review"로 설정
- `/gh-pr` 템플릿이 priority 레이블을 linked issue에서 상속하거나 `p1`을 기본 적용
- `/gh-issue` 템플릿이 생성 시점에 `p0`/`p1`/`p2` priority 레이블 적용
- `pm-hook.sh`를 idempotent fallback으로 유지 (직접 처리 실패 또는 수동 PR 대비)

**Non-Goals:**
- `pm-hook.sh` 완전 제거 또는 hook 구조 변경
- priority 레이블 외 다른 Project field (e.g., Iteration, Milestone) 자동화
- 복수 linked issue 전체를 처리하는 배치 로직 (첫 번째 matched issue만 처리)

## Decisions

### D1: 커맨드 직접 처리 + 훅 이중 방어
**결정**: `/gh-pr` 템플릿이 `gh pr create` 이후 명시적으로 Project 처리를 수행하고, `pm-hook.sh`는 fallback으로 유지.

**이유**: 훅 단독 의존은 세션 환경에 종속적. 커맨드 직접 처리가 성공하면 훅은 no-op (idempotent). 훅이 fallback으로 존재하면 수동 `gh pr create` 실행 시에도 보정 가능.

**대안 고려**: 훅만 강화 → 훅 환경 부재 시 완전 실패. 커맨드만 처리, 훅 제거 → 수동 실행 대비 불가.

### D2: Project item-edit를 위한 Project item ID 조회 방법
**결정**: `gh pr view --json number` 로 PR number를 얻은 후 `gh project item-list` 에서 `content.number` 로 item ID를 조회. PR URL 기반 매칭 사용.

**이유**: `gh pr create` 출력에서 PR URL 파싱이 가장 안정적. item-list에서 URL 또는 number로 매칭.

### D3: Project update 실패 시 PR 생성 차단 여부
**결정**: warn-not-fail — Project 처리 실패 시 경고 메시지 출력 후 PR 생성은 성공으로 마무리.

**이유**: PR 생성 자체가 핵심 작업. Project 상태는 중요하지만 PR 실패보다 낫다. 훅이 fallback으로 재시도.

### D4: priority 레이블 상속 로직
**결정**: linked issue에서 `p0`/`p1`/`p2` 레이블을 `gh issue view --json labels`로 읽어 PR에 적용. 없으면 `p1` 기본값.

**이유**: priority 레이블이 이슈와 PR 간에 일관성을 가져야 하고, 이슈에 이미 지정된 경우 재입력 불필요.

## Risks / Trade-offs

- **[Risk] `PM_PROJECT_ID` 등 환경 변수 미설정** → 커맨드 내 `gh project item-list --owner pureliture` + `--project-id PVT_kwHOA6302M4BT5fA` 하드코딩으로 완화. 환경 변수가 있으면 그것을 우선.
- **[Risk] Linked issue 없는 PR** → `Closes #N` 패턴 없으면 issue status 단계 skip (warn 후 계속).
- **[Risk] `gh project item-list` 500 limit 초과** → 현재 Project 규모에서 문제 없음. 장기적으로 cursor 페이지네이션 필요.
- **[Trade-off] 커맨드 길이 증가** → 템플릿이 길어지지만 명시적 보장이 훨씬 가치 있음.

## Open Questions

- `PM_PRIORITY_FIELD_ID` 와 P0/P1/P2 option ID가 `docs/pm-board.md`에 문서화되어 있지 않음 — 구현 전 `scripts/setup-project-ids.sh`로 탐색 필요.
