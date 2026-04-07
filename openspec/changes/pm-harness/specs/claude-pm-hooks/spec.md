## ADDED Requirements

### Requirement: git checkout 훅 — 이슈 In Progress 이동
`.claude/settings.json`의 PostToolUse(Bash) 훅은 `git checkout -b` 명령어를 감지하면 브랜치명에서 이슈 번호를 추출해 GitHub Projects V2의 해당 이슈 Status를 "In Progress"로 변경해야 한다.

#### Scenario: feat 브랜치 생성 시 이슈 이동
- **WHEN** Claude Code가 `git checkout -b feat/42-some-feature` 명령어를 실행하면
- **THEN** GitHub Issue #42의 Projects Status가 "In Progress"로 자동 변경되어야 한다

#### Scenario: 이슈 번호 없는 브랜치는 무시
- **WHEN** 브랜치명에 이슈 번호 패턴(`/<숫자>-`)이 없으면
- **THEN** 훅이 아무 동작도 하지 않고 exit 0으로 종료되어야 한다

#### Scenario: 훅 실패 시 무시
- **WHEN** `gh` CLI 호출이 실패하거나 Projects 업데이트가 안 되면
- **THEN** 훅이 exit 0으로 종료되어 Claude Code 세션이 중단되지 않아야 한다

### Requirement: gh pr create 훅 — 이슈 In Review 이동
PostToolUse(Bash) 훅은 `gh pr create` 명령어를 감지하면 PR 본문의 `Closes #N` 패턴에서 이슈 번호를 추출해 해당 이슈 Status를 "In Review"로 변경해야 한다.

#### Scenario: PR 생성 시 이슈 이동
- **WHEN** Claude Code가 `gh pr create` 명령어를 실행하면
- **THEN** PR 본문의 Closes #N 이슈가 Projects Status "In Review"로 자동 변경되어야 한다

#### Scenario: Closes 패턴 없는 PR은 무시
- **WHEN** PR 본문에 `Closes #N` 패턴이 없으면
- **THEN** 훅이 아무 동작도 하지 않고 exit 0으로 종료되어야 한다
