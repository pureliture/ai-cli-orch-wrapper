## 1. `/gh-pr` 템플릿 갱신

- [x] 1.1 `templates/commands/gh-pr.md`와 `.claude/commands/gh-pr.md`의 현재 single-linked-issue 파싱 단계를 검토한다
- [x] 1.2 step 8을 갱신해 PR 본문에서 모든 `Closes #N` / `Fixes #N` / `Resolves #N` 참조를 순서 보존 + 중복 제거된 linked issue 목록으로 추출한다
- [x] 1.3 step 8의 Project status 처리 로직을 갱신해 linked issue 목록의 모든 이슈를 `"In Review"`로 전환하도록 만든다
- [x] 1.4 step 9의 priority 상속 로직을 갱신해 linked issue 목록 전체에서 `p0 > p1 > p2` 최고 우선순위를 선택하고, 없으면 `p1`을 적용하도록 만든다

## 2. Fallback 자동화 동기화

- [x] 2.1 `scripts/pm-hook.sh`의 current linked issue 추출 경로(command 문자열, PR body, branch fallback)를 검토한다
- [x] 2.2 hook이 multiple closing keyword를 ordered unique linked issue 목록으로 파싱하도록 갱신한다
- [x] 2.3 hook의 issue status 업데이트를 linked issue 목록 전체에 반복 적용하도록 갱신한다
- [x] 2.4 hook의 PR priority 계산을 highest-wins 정책과 `p1` 기본값에 맞게 동기화하고, 중복 참조가 있어도 중복 적용하지 않도록 보장한다

## 3. 검증

- [x] 3.1 서로 다른 priority를 가진 두 linked issue를 포함한 PR 본문으로 `/gh-pr` 흐름을 검증해 PR에 가장 높은 priority만 적용되는지 확인한다
- [x] 3.2 여러 linked issue가 모두 PM Project에서 `"In Review"`로 전환되는지 확인한다
- [x] 3.3 linked issue에 priority가 없을 때 `p1`이 적용되는지, 같은 issue를 여러 번 참조해도 중복 상태 변경이나 중복 label 추가가 없는지 확인한다
