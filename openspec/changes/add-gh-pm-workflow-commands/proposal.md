## Why

PM 워크플로우의 수동 단계(이슈 생성, 보드 전환, 브랜치 생성, PR 생성, 리뷰 후속 이슈)가 세션마다 자연어로 재발명되어 컨텍스트 소모와 일관성 붕괴를 유발한다. 이를 Claude Code slash commands(`/gh-*`)로 표준화하고, 이슈 제목 컨벤션을 conventional commit 형식으로 전환해 레이블과 중복되는 제목 접두사를 제거한다.

## What Changes

- **New**: `/gh-issue` — 이슈 생성 + type/sprint 레이블 + Project #3 Backlog 자동 배정
- **New**: `/gh-start #N` — 이슈 → In Progress 전환 + `status:in-progress` 레이블 + `feat/N-slug` 브랜치 생성 (non-ASCII slug 처리 포함)
- **New**: `/gh-pr` — PR 생성 (conventional commit 제목, `Closes #N`, CI checklist, Epic reminder)
- **New**: `/gh-followup` — 리뷰 후속 이슈 생성 (`origin:review` 레이블, `From: #N review comment` 본문)
- **New**: `:multi` variants — 위 4개 커맨드 각각에 대해 `/octo:multi` 검증을 결합한 variant (`.claude/commands/gh-*/multi.md`)
- **New**: `sprint:v3`, `sprint:v4`, `origin:review` 레이블 추가 (`scripts/setup-github-labels.sh`, idempotent)
- **Convention change**: 이슈 제목을 `[Sprint V3][Task] 설명` → `feat: 설명` 형식으로 전환 (V3부터 즉시 적용)
- **Updated**: `docs/pm-board.md` — 신규 커맨드 계열 구조 및 제목 컨벤션 반영

## Capabilities

### New Capabilities
- `gh-issue-cmd`: `/gh-issue` slash command — 이슈 생성, 레이블, Project #3 Backlog 배정
- `gh-start-cmd`: `/gh-start #N` slash command — In Progress 전환, 브랜치 생성
- `gh-pr-cmd`: `/gh-pr` slash command — PR 생성, Closes #N, CI checklist
- `gh-followup-cmd`: `/gh-followup` slash command — 리뷰 후속 이슈 생성, origin:review
- `gh-multi-variants`: `:multi` variants — /octo:multi + 각 gh-* 커맨드 조합
- `gh-label-setup`: setup-github-labels.sh에 신규 레이블 추가 (idempotent)

### Modified Capabilities
- (없음 — 기존 spec 수준의 behavior 변경 없음)

## Impact

- `.claude/commands/` — 신규 파일 8개 (gh-issue.md, gh-start.md, gh-pr.md, gh-followup.md + 각 multi.md)
- `scripts/setup-github-labels.sh` — sprint:v3, sprint:v4, origin:review 레이블 블록 추가
- `docs/pm-board.md` — 커맨드 계열 표 및 이슈 제목 컨벤션 섹션 추가
- GitHub Project #3 (`PVT_kwHOA6302M4BT5fA`) — Status field (`PVTSSF_lAHOA6302M4BT5fAzhBFN48`) 사용
- 의존성: `gh` CLI (인증 완료), `/octo:multi` 스킬 (`:multi` variants)
