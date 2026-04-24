# Phase 3 계획 — GitHub Kanban 명령 하네스 보완

**작성일:** 2026-04-24

**선행 조건:** Phase 2 `github-kanban-ops` canonical 반영 완료

**목적:** `.claude/commands/gh-*` 명령어를 `github-kanban-ops` canonical의 실행 wrapper로 정리한다. Codex 하네스로 마이그레이션하기 전에 GitHub Project 연동 계약, issue type, label, priority, parent linkage 규칙을 `.claude` 하네스에서 먼저 확정한다.

---

## 범위

### 대상 명령

| 명령 | 역할 |
|------|------|
| `/gh-issue` | GitHub issue 생성, label 적용, Project 등록, parent linkage |
| `/gh-start` | issue를 In Progress로 전환하고 작업 branch/worktree 생성 |
| `/gh-pr` | PR 생성, PR/linked issue를 In Review로 전환, durable label 상속 |
| `/gh-pr-followup` | PR review thread를 즉시 해결하거나 follow-up issue로 이연 |

### 제외

- `*:multi` 명령어: Phase 1에서 제거 완료
- OpenSpec/OPSX 명령어
- Codex 하네스 생성/동기화: Phase 4에서 수행
- `.aco-worktrees` 경로 rename: Phase 4에서 Codex migration 범위로 판단

---

## Canonical 기준

Phase 3의 단일 기준은 `.claude/skills/github-kanban-ops/`다.

| 항목 | 기준 |
|------|------|
| Skill | `.claude/skills/github-kanban-ops/SKILL.md` |
| Reference | `.claude/skills/github-kanban-ops/references/github-kanban-model.md` |
| Issue generator | `.claude/skills/github-kanban-ops/scripts/make_issue_body.py` |
| Project reference | `docs/reference/project-board.md` |

### Issue Body Generator Contract

`make_issue_body.py`는 `epic`/`task`/`bug`/`chore`마다 type-specific canonical section을 출력한다.

| Type | Canonical sections |
|------|--------------------|
| `epic` | `Summary`, `Outcome`, `Scope`, `Child Issues`, `Exit Criteria`, `Notes` |
| `task` | `Summary`, `Outcome`, `Parent`, `Scope`, `Acceptance Criteria`, `Notes` |
| `bug` | `Summary`, `Actual Behavior`, `Expected Behavior`, `Reproduction`, `Impact`, `Parent`, `Acceptance Criteria`, `Notes` |
| `chore` | `Summary`, `Operational Goal`, `Constraints`, `Parent`, `Definition of Done`, `Notes` |

명령 wrapper는 사용자 입력과 repository context로 `--summary`, `--outcome`, `--scope`, `--acceptance`, `--notes` 등 필요한 인자를 채워 placeholder 본문이 생성되지 않게 해야 한다.

---

## Project Config Contract

`/gh-*` 명령어는 Project ID와 field/option ID를 직접 정책처럼 취급하지 않는다. 모든 명령은 아래 contract를 따른다.

### Resolution Order

1. 환경변수 값을 우선 사용한다.
2. 환경변수가 없으면 `docs/reference/project-board.md`에 문서화된 현재 repository fallback 값을 사용한다.
3. fallback도 없거나 Project update가 실패하면 명령별 실패/경고 정책을 따른다.

### Environment Variables

| 변수 | 용도 |
|------|------|
| `PM_PROJECT_NUMBER` | `gh project item-add`에 사용할 Project 번호 |
| `PM_PROJECT_ID` | `gh project item-edit`에 사용할 Project node ID |
| `PM_STATUS_FIELD_ID` | `Status` field node ID |
| `PM_BACKLOG_OPTION_ID` | `Backlog` option ID |
| `PM_READY_OPTION_ID` | `Ready` option ID |
| `PM_IN_PROGRESS_OPTION_ID` | `In Progress` option ID |
| `PM_IN_REVIEW_OPTION_ID` | `In Review` option ID |
| `PM_DONE_OPTION_ID` | `Done` option ID |
| `PM_PRIORITY_FIELD_ID` | `Priority` field node ID |
| `PM_P0_OPTION_ID` | `P0` option ID |
| `PM_P1_OPTION_ID` | `P1` option ID |
| `PM_P2_OPTION_ID` | `P2` option ID |

### Failure Policy

| 작업 | 실패 처리 |
|------|-----------|
| Issue/PR 생성 | 실패로 처리 |
| Project item 추가 | 경고 후 계속, 생성된 URL은 보고 |
| Status field update | 핵심 workflow 실패로 보고하되 생성된 issue/PR은 유지 |
| Priority field update | 경고 후 계속 |
| Parent native linkage | 경고 후 body fallback 유지 |
| Epic checklist update | best-effort 경고 후 계속 |

### Retry Policy

GitHub Project item indexing lag를 고려해 item lookup은 최대 5회 재시도한다.

```bash
for attempt in 1 2 3 4 5; do
  ITEM_ID="$(gh project item-list "$PM_PROJECT_NUMBER" --owner pureliture --format json --limit 500 \
    --jq '.items[] | select(.content.number == <N> and .content.type == "Issue") | .id')"
  [ -n "$ITEM_ID" ] && break
  sleep 2
done
```

---

## Label Contract

Labels는 durable classification만 담당한다.

### 허용

| Label | 규칙 |
|-------|------|
| `type:epic` | `epic:` issue title과 일치 |
| `type:task` | `task:` issue title과 일치 |
| `type:bug` | `bug:` issue title과 일치 |
| `type:chore` | `chore:` issue title과 일치 |
| `area:*` | affected area가 명확할 때 적용 |
| `origin:review` | PR review feedback에서 생성된 work item에만 적용 |

### 금지

- `status:*`
- `sprint:*`
- `p0`, `p1`, `p2`
- `size:*`
- `type:feature`
- `type:story`
- `type:spike`

---

## Priority Contract

Priority는 label이 아니라 GitHub Project `Priority` field에만 저장한다.

### 판단 주체

`/gh-issue` 또는 `/gh-pr-followup`을 수행하는 LLM이 사용자 입력과 issue context를 보고 `P0`/`P1`/`P2`를 판단한다.

### 판단 기준

| Priority | 기준 |
|----------|------|
| `P0` | production breakage, data loss, auth/build blocker, merge blocker |
| `P1` | core workflow improvement, normal bug, planned implementation task |
| `P2` | cleanup, docs-only, non-blocking chore, nice-to-have follow-up |

### 불확실한 경우

- 생성 전에 짧게 질문할 수 있으면 질문한다.
- 자동 생성을 우선해야 하면 Priority를 unset으로 두고 triage 필요를 보고한다.
- 기본 `P1` 강제는 하지 않는다.

---

## Command별 수정 계획

### `/gh-issue`

현재 문제:

- `feat:`/`fix:`/`spike:` title mapping을 사용한다.
- `type:feature`, `type:spike` label을 만들 수 있다.
- 자체 issue body template을 사용한다.
- priority label 중심 문구가 남아 있다.

수정 방향:

1. 허용 title type을 `epic`, `task`, `bug`, `chore`로 제한한다.
2. `type:*` label은 title prefix와 1:1로 매핑한다.
3. `make_issue_body.py`를 canonical body/title generator로 사용한다.
4. `area:*`는 명확할 때만 적용한다.
5. `origin:review`는 일반 `/gh-issue`에서는 사용자가 명시한 경우에만 적용한다.
6. Project에 추가하고 `Status=Backlog`를 설정한다.
7. Priority는 LLM 판단으로 Project field에 설정한다. 판단 불가 시 unset + triage warning.
8. parent epic이 있으면 native sub-issue, child body `Parent`, epic checklist를 best-effort로 처리한다.

완료 조건:

- `type:feature`, `type:spike`, `spike:` 참조가 사라진다.
- priority label 생성/기본값 문구가 사라진다.
- `make_issue_body.py` path가 `github-kanban-ops`를 가리킨다.

### `/gh-start`

현재 문제:

- `status:in-progress` label을 추가한다.
- `type:feature`, `type:spike` branch mapping이 남아 있다.
- Project config 값이 command 안에 직접 박혀 있다.

수정 방향:

1. Project `Status=In Progress`만 workflow state로 변경한다.
2. `status:in-progress` label 추가를 제거한다.
3. branch prefix mapping을 다음으로 제한한다:
   - `type:bug` → `fix`
   - `type:chore` → `chore`
   - `type:task` → `feat`
   - `type:epic` → `feat`
4. Project config contract를 사용한다.
5. `.aco-worktrees/fix-<N>` 경로는 Phase 3에서 유지하고 Phase 4에서 재검토한다.

완료 조건:

- `status:in-progress`, `type:feature`, `type:spike` 참조가 사라진다.
- Project ID/field/option ID는 env 우선 + fallback으로 설명된다.

### `/gh-pr`

현재 문제:

- issue title이 `type: description`이라는 점은 맞지만 예시는 기존 `feat:` 기반이다.
- priority label을 PR에 기본 `p1`로 적용할 수 있다.
- `status:*`, `sprint:*` label 제외 문구는 있으나 priority label sync가 남아 있다.

수정 방향:

1. linked issue title은 `epic/task/bug/chore: summary`로 해석한다.
2. PR title은 실제 변경 scope를 보고 `feat(scope)`, `fix(scope)`, `chore(scope)`, `docs(scope)` 중 하나로 생성한다.
3. PR item을 Project에 추가하고 `Status=In Review`로 설정한다.
4. linked issue item도 `Status=In Review`로 설정한다.
5. PR label sync는 `type:*`, `area:*`, `origin:review`만 수행한다.
6. priority/status/sprint/size label은 복사하지 않는다.
7. Priority field는 PR에 mirror하지 않는다.

완료 조건:

- `p0`, `p1`, `p2` label sync 문구가 사라진다.
- PR label sync namespace가 durable labels로 제한된다.
- Project config contract를 사용한다.

### `/gh-pr-followup`

현재 문제:

- deferred issue body가 canonical generator와 다르다.
- priority setting 기준이 없다.
- Project Backlog 등록만 하고 Status/Priority field contract가 약하다.

수정 방향:

1. unresolved review thread를 immediate fix 또는 deferred issue로 분류한다.
2. deferred issue type은 `task`, `bug`, `chore`만 허용한다.
3. deferred issue에는 `origin:review` label을 적용한다.
4. body는 `make_issue_body.py` canonical 형식을 따른다.
5. Project `Status=Backlog`를 설정한다.
6. Priority는 review comment 위험도와 범위를 보고 LLM이 판단한다. 판단 불가 시 unset + triage warning.

완료 조건:

- follow-up issue가 `github-kanban-ops` body/title/label contract를 따른다.
- Project status/priority 처리 방식이 `/gh-issue`와 일관된다.

---

## 검증 계획

### Static Search

다음 검색에서 `/gh-*`와 관련 문서에 stale rule이 남지 않아야 한다.

```bash
rg -n 'type:feature|type:story|type:spike|spike:|story:|status:in-progress|sprint:|p0|p1|p2|/octo:multi|multi-AI' \
  .claude/commands/gh-*.md docs/guides/github-workflow.md .claude/skills/github-kanban-ops
```

단, 금지 label을 설명하는 canonical 문서의 deny-list는 허용한다.

### Generator Smoke Test

```bash
python3 -m py_compile .claude/skills/github-kanban-ops/scripts/make_issue_body.py
python3 .claude/skills/github-kanban-ops/scripts/make_issue_body.py \
  --type task \
  --title "Migrate gh commands" \
  --summary "GitHub PM slash commands를 github-kanban-ops canonical로 정리한다." \
  --outcome "gh-issue, gh-start, gh-pr, gh-pr-followup이 동일한 Project field와 label contract를 사용한다." \
  --scope "Phase 3에서는 .claude/commands/gh-* 실행 wrapper만 수정한다." \
  --parent "#42" \
  --acceptance "[ ] Commands follow github-kanban-ops" \
  --acceptance "[ ] Static searches show stale labels are removed from gh command rules" \
  --notes "Base template parity and Codex harness migration은 Phase 4에서 별도 처리한다." \
  --format all
```

### Review Gate

Phase 2 subagent review 결과를 먼저 반영한 뒤 Phase 3 patch를 시작한다.

---

## 산출물

- Updated `.claude/commands/gh-issue.md`
- Updated `.claude/commands/gh-start.md`
- Updated `.claude/commands/gh-pr.md`
- Updated `.claude/commands/gh-pr-followup.md`
- Updated `docs/reference/project-board.md` if fallback/env contract needs more detail
- Static search results showing stale rules are removed

---

## Phase 4로 넘길 항목

- `.claude` command/skill을 Codex-native harness로 변환
- `.aco-worktrees` naming 유지 여부 결정
- Codex에서 Project config contract를 공유하는 위치 확정
- `.agents/skills/github-kanban-ops`와 Codex skill surface의 최종 관계 정리
