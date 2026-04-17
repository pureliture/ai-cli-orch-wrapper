## MODIFIED Requirements

### Requirement: gh pr create 훅 — 이슈 In Review 이동
The PostToolUse(Bash) hook SHALL detect `gh pr create`, interpret linked issues with the same closing-reference rules as `/gh-pr`, and reconcile their Project Status to "In Review". This hook SHALL remain an idempotent fallback for manual `gh pr create` runs or command-side drift rather than replacing the primary `/gh-pr` Project update flow.

#### Scenario: PR 생성 시 이슈 이동
- **WHEN** Claude Code가 `gh pr create` 명령어를 실행하고 PR body에 `Closes #N`, `Fixes #N`, 또는 `Resolves #N` 참조가 있으면
- **THEN** 훅은 해당 linked issue의 Projects Status를 "In Review"로 맞춰야 한다

#### Scenario: Project에 없는 linked issue도 보정
- **WHEN** closing reference로 찾은 linked issue가 아직 Project에 없으면
- **THEN** 훅은 필요 시 그 issue를 Project에 추가한 뒤 Status를 "In Review"로 설정해야 한다

#### Scenario: Closing reference 없는 PR은 무시
- **WHEN** PR 본문에 closing issue reference가 없으면
- **THEN** 훅이 아무 동작도 하지 않고 exit 0으로 종료되어야 한다

#### Scenario: 훅 실패 시 무시
- **WHEN** `gh` CLI 호출이나 Projects 업데이트가 실패하면
- **THEN** 훅이 warning만 남기고 exit 0으로 종료되어 Claude Code 세션이 중단되지 않아야 한다
