## 1. 사전 준비 — Project Field ID 탐색

- [x] 1.1 `scripts/setup-project-ids.sh` 실행 또는 `gh project field-list 3 --owner pureliture --format json`으로 Priority field ID 및 p0/p1/p2 option ID 확인
- [x] 1.2 확인한 `PM_PRIORITY_FIELD_ID`, `PM_P0_OPTION_ID`, `PM_P1_OPTION_ID`, `PM_P2_OPTION_ID` 값을 `docs/pm-board.md`에 문서화

## 2. `/gh-issue` 템플릿 — priority 레이블 단계 추가

- [x] 2.1 `templates/commands/gh-issue.md` 읽기 — 현재 레이블 처리 단계 확인
- [x] 2.2 이슈 생성 단계의 `--label` 인자에 `p0`/`p1`/`p2` 선택/추론 단계 추가
- [x] 2.3 기본값 `p1` 적용 로직 명시 (명시적 선택 없는 경우)
- [x] 2.4 `gh-issue-cmd` spec 시나리오와 대조해 검증

## 3. `/gh-pr` 템플릿 — PM Project status 단계 추가

- [x] 3.1 `templates/commands/gh-pr.md` 읽기 — 현재 PR 생성 후 단계 확인
- [x] 3.2 PR 생성 후 `gh project item-add 3 --owner pureliture --url <pr_url>` 단계 추가
- [x] 3.3 PR Project item ID 조회 (`gh project item-list`에서 PR URL 매칭) 단계 추가
- [x] 3.4 PR item Status → "In Review" 설정 (`gh project item-edit`) 단계 추가
- [x] 3.5 `Closes #N` / `Fixes #N` / `Resolves #N` 키워드 파싱으로 linked issue 번호 추출 단계 추가
- [x] 3.6 linked issue Project item Status → "In Review" 설정 단계 추가
- [x] 3.7 warn-not-fail 처리 — 각 Project 단계 실패 시 경고 출력 후 계속 진행 명시

## 4. `/gh-pr` 템플릿 — priority 레이블 상속 단계 추가

- [x] 4.1 `gh issue view #N --json labels`로 linked issue의 `p0`/`p1`/`p2` 레이블 읽기 단계 추가
- [x] 4.2 PR에 상속된 priority 레이블 적용 (`gh pr edit --add-label`) 단계 추가
- [x] 4.3 linked issue 없거나 priority 없는 경우 `p1` 기본 적용 단계 명시

## 5. `scripts/pm-hook.sh` — fallback 역할 명시

- [x] 5.1 `pm-hook.sh` 읽기 — 현재 PR 감지 및 Project 처리 로직 확인
- [x] 5.2 파일 상단 주석에 "fallback/safety-net: /gh-pr 직접 처리 실패 또는 수동 gh pr create 대비" 명시
- [x] 5.3 priority 레이블 상속 로직 훅에도 추가 (linked issue `p0`/`p1`/`p2` 읽어 PR에 적용, 없으면 `p1`)

## 6. OpenSpec 기존 change 스펙 업데이트

- [x] 6.1 `openspec/changes/add-gh-pm-workflow-commands/specs/gh-pr-cmd/spec.md`에 이 change의 MODIFIED 내용 반영 여부 검토
- [x] 6.2 `openspec/changes/add-gh-pm-workflow-commands/specs/gh-issue-cmd/spec.md`에 이 change의 MODIFIED 내용 반영 여부 검토

## 7. 검증

- [x] 7.1 `/gh-issue` 테스트 — priority 레이블이 생성 이슈에 포함되는지 확인
- [x] 7.2 `/gh-pr` 테스트 — PR 생성 후 Project #3에 추가되고 Status가 "In Review"인지 확인
- [x] 7.3 linked issue도 "In Review"로 전환되는지 확인
- [x] 7.4 Project 업데이트 실패 시 PR 생성이 중단되지 않는지 확인 (warn-not-fail)
- [x] 7.5 `pm-hook.sh` fallback 동작 확인 — 수동 `gh pr create` 실행 시에도 Project 보정되는지 확인
