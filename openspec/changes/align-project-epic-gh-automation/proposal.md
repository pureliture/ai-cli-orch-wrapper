## Why

현재 GitHub Project #3 운영은 native `Parent issue`/`Sub-issues progress`를 epic의 기준으로 사용하지만, 문서와 `/gh-*` 자동화는 여전히 미사용 custom `epic` field, 느슨한 Backlog/Priority 세팅, 불완전한 linked issue status 전환을 전제로 섞여 있다. 이 불일치 때문에 board 문서, issue 생성 자동화, PR 상태 동기화가 서로 다른 계약을 따르고 있어 운영 결과가 흔들린다.

## What Changes

- Project #3의 epic 관리 기준을 native `Parent issue`/`Sub-issue` 관계로 명확히 하고, custom `epic` field는 제거하거나 명시적으로 미사용 상태로 문서화한다.
- `/gh-issue`를 갱신해 새 이슈를 Project #3에 추가한 뒤 `Status=Backlog`를 명시적으로 설정하고, label priority(`p0`/`p1`/`p2`)를 Project `Priority=P0/P1/P2` field에도 미러링한다.
- `/gh-issue`에 parent epic이 제공되면 `Parent epic: #N` body convention을 유지하면서 GitHub GraphQL `addSubIssue`로 native sub-issue linkage를 시도하고, 실패 시 warn-not-fail로 계속 진행하도록 정리한다.
- `/gh-pr`의 closing issue reference 해석과 linked issue `"In Review"` 전환 규칙을 보강해 PR #28 / issue #27류의 상태 불일치가 재발하지 않도록 한다.
- `docs/pm-board.md`와 Project view contract를 실제 운영 상태와 동일하게 맞춘다.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `github-projects-board`: epic source of truth와 Triage/Active Sprint/Roadmap view 계약을 실제 Project #3 운영 기준으로 정렬한다.
- `gh-issue-cmd`: `/gh-issue`가 issue 생성 후 Project Backlog 상태를 명시적으로 설정하고, parent epic 제공 시 native sub-issue linkage를 시도하도록 변경한다.
- `gh-issue-priority-label`: `/gh-issue`의 `p0`/`p1`/`p2` label 선택 결과를 Project `Priority` field까지 동기화하도록 확장한다.
- `gh-pr-project-status`: `/gh-pr`가 closing issue references를 더 신뢰성 있게 찾아 linked issue status를 `"In Review"`로 전환하도록 보강한다.
- `claude-pm-hooks`: `gh pr create` fallback hook이 `/gh-pr`와 같은 closing issue 해석 규칙으로 상태 보정을 수행하도록 정렬한다.

## Impact

- `templates/commands/gh-issue.md` and `.claude/commands/gh-issue.md`
- `templates/commands/gh-pr.md` and `.claude/commands/gh-pr.md`
- `scripts/pm-hook.sh`
- `docs/pm-board.md`
- GitHub Project #3 field/view contract and GraphQL sub-issue linkage flow
