## 1. Project contract 정렬

- [x] 1.1 `docs/pm-board.md`를 갱신해 epic의 source of truth가 GitHub native `Parent issue` / `Sub-issue` 관계임을 명시하고 custom `epic` field를 unused/deprecated로 정리한다
- [x] 1.2 `docs/pm-board.md`의 Active Sprint, Triage, Roadmap view 설명을 실제 Project #3 운영 계약과 일치하도록 갱신한다
- [x] 1.3 필요하면 GitHub Project #3에서 custom `epic` field와 view 구성을 정리하거나, 즉시 제거하지 못하는 경우 문서상 deprecated 상태를 명확히 표시한다

## 2. `/gh-issue` 자동화 보강

- [x] 2.1 `templates/commands/gh-issue.md`와 `.claude/commands/gh-issue.md`를 갱신해 issue 생성 후 Project item ID를 조회하고 `Status=Backlog`를 명시적으로 설정한다
- [x] 2.2 `/gh-issue`의 priority 선택 결과를 Project `Priority` field(`P0`/`P1`/`P2`)에 매핑하는 단계를 추가한다
- [x] 2.3 parent epic이 제공되면 body의 `Parent epic: #N`를 유지하면서 `gh api graphql` 기반 `addSubIssue` native linkage를 시도하는 단계를 추가한다
- [x] 2.4 native sub-issue linkage 실패 시 warning만 출력하고 issue creation은 유지하는 warn-not-fail 흐름을 문서화한다

## 3. `/gh-pr` 및 fallback 보정

- [x] 3.1 `templates/commands/gh-pr.md`와 `.claude/commands/gh-pr.md`를 갱신해 closing issue reference를 더 신뢰성 있게 추출하고 linked issue를 `In Review`로 전환하는 단계를 보강한다
- [x] 3.2 linked issue가 아직 Project #3에 없을 때도 item-add 후 `In Review`를 설정하도록 regression-safe 흐름을 추가한다
- [x] 3.3 `scripts/pm-hook.sh`를 갱신해 `/gh-pr`와 동일한 closing reference 해석 규칙으로 linked issue status를 보정하는 idempotent fallback을 유지한다

## 4. 검증

- [x] 4.1 `/gh-issue` 실행 시 새 이슈가 Project #3에 추가되고 `Status=Backlog`, `Priority=P0/P1/P2`가 올바르게 설정되는지 확인한다
- [x] 4.2 parent epic이 있는 `/gh-issue` 실행 시 `Parent epic: #N` body line과 native sub-issue linkage가 모두 적용되고, GraphQL 실패 시 warning-only로 계속되는지 확인한다
- [x] 4.3 `/gh-pr` 실행 시 linked issue가 Project에 없더라도 `In Review`로 전환되는지 확인하고 PR #28 / issue #27 회귀 케이스를 재현해 검증한다
- [x] 4.4 `pm-hook.sh` fallback 경로에서도 linked issue status 보정이 동일하게 동작하는지 확인한다
