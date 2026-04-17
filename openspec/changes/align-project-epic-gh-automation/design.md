## Context

이 저장소의 PM 운영은 이미 GitHub native issue 관계와 Projects V2를 중심으로 돌아가지만, `/gh-*` 커맨드와 `docs/pm-board.md`는 그 운영 계약을 끝까지 강제하지 못하고 있다. 특히 `/gh-issue`는 Project item 추가만 하고 `Status=Backlog`나 `Priority` field를 명시적으로 세팅하지 않으며, parent epic이 있어도 body-level `Parent epic: #N`만 남기고 native sub-issue 연결은 시도하지 않는다. `/gh-pr` 역시 linked issue를 `"In Review"`로 전환한다고 문서화돼 있지만, closing reference 해석 실패나 fallback drift로 인해 실제 상태가 남는 회귀가 발생했다.

이 change의 핵심은 새 PM 모델을 도입하는 것이 아니라, 이미 채택한 운영 모델을 하나로 고정하는 것이다. 즉 epic의 source of truth는 GitHub native `Parent issue`/`Sub-issue`, 상태와 우선순위는 Project fields, 레이블은 분류 축으로 정리하고, `/gh-*` 자동화와 문서가 그 계약을 동일하게 따르도록 만든다.

## Goals / Non-Goals

**Goals:**
- Project #3에서 epic 관계의 단일 source of truth를 native `Parent issue`/`Sub-issue`로 명시한다.
- `/gh-issue`가 생성한 이슈를 Project #3에 추가한 뒤 `Status=Backlog`와 `Priority=P0/P1/P2`를 명시적으로 세팅하게 한다.
- parent epic이 있는 `/gh-issue` 호출에서 body fallback과 native sub-issue linkage를 모두 수행하되, GraphQL 실패가 issue creation을 롤백하지 않도록 한다.
- `/gh-pr`와 `pm-hook.sh`가 같은 closing reference 해석 규칙으로 linked issue를 `"In Review"` 상태로 수렴시킨다.
- `docs/pm-board.md`와 실제 Project views가 같은 필터/그룹 계약을 표현하도록 맞춘다.

**Non-Goals:**
- 새로운 Project field를 추가하지 않는다.
- Epic checklist 자동 갱신까지 이번 change 범위에 넣지 않는다.
- `/gh-start`, `/gh-pr-followup`, release workflow의 의미를 변경하지 않는다.
- cross-repo issue linkage나 외부 tracker 연동을 지원하지 않는다.

## Decisions

### D1: Epic 관계는 native GitHub issue relationship를 단일 source of truth로 본다

**결정**: epic 관리 기준은 `type:epic` 라벨을 가진 issue와 GitHub native `Parent issue`/`Sub-issue` 관계로 정의한다. custom Project `epic` field는 제거하거나, 제거가 당장 어렵다면 명시적으로 unused/deprecated로 취급한다.

**이유**: 현재 운영은 이미 native 관계를 기준으로 하고 있는데 Project field가 병행되면서 “어디가 진실인가”가 흐려졌다. source of truth를 하나로 줄여야 automation과 docs가 안정된다.

**대안 고려**:
- custom `epic` field를 계속 유지: body, native relationship, field 세 군데를 동시에 관리해야 해 drift 위험이 커진다.
- native relationship만 쓰고 body fallback 제거: GitHub UI/GraphQL 바깥에서 맥락이 사라지므로 이식성과 가독성이 떨어진다.

### D2: `/gh-issue`는 issue create 이후 Project field를 명시적으로 세팅한다

**결정**: `/gh-issue`는 `gh issue create` 후 issue URL/번호를 확보하고, `gh project item-add`로 Project #3에 추가한 다음 item ID를 조회해 `Status=Backlog`와 `Priority` field를 각각 `gh project item-edit`로 설정한다.

**이유**: 현재는 label과 project add만으로 Backlog/Priority가 암묵적으로 채워지길 기대하지만, GitHub Projects는 그 보장을 제공하지 않는다. 이슈 생성 커맨드가 직접 field를 맞춰야 문서와 실제 board가 일치한다.

**대안 고려**:
- label만 유지하고 Project Priority는 비워둔다: board 정렬과 triage 기준이 불완전해진다.
- workflow/hook에서 나중에 보정한다: issue 생성 직후 상태가 흔들리고, `/gh-issue` 계약이 약해진다.

### D3: Parent epic linking은 “portable body + native linkage” 이중 경로를 사용한다

**결정**: parent epic이 주어지면 issue body 첫 줄에 `Parent epic: #<N>`를 유지하고, 이어서 GraphQL `addSubIssue(input: { issueId, subIssueUrl, replaceParent: false })`를 호출해 native sub-issue linkage를 시도한다. GraphQL 실패는 경고만 출력하고 issue 생성 자체는 유지한다.

**이유**: native relation은 GitHub 내 canonical 관계를 제공하지만, body fallback은 CLI 출력과 문서 상에서 즉시 읽히는 맥락을 준다. 둘을 함께 가져가면 운영성과 이식성을 동시에 확보할 수 있다.

**대안 고려**:
- body link만 유지: GitHub native parent/sub-issue progress를 활용하지 못한다.
- native linkage만 사용: mutation 실패 시 parent 정보가 완전히 사라진다.
- mutation 실패 시 issue 생성 롤백: 실패 한 지점 때문에 사용자가 다시 전체 생성 플로우를 반복해야 한다.

### D4: `/gh-pr`와 `pm-hook.sh`는 같은 closing reference 해석 규칙을 공유한다

**결정**: `/gh-pr` 템플릿이 primary path로 closing references를 파싱해 linked issue 상태를 `"In Review"`로 전환하고, `pm-hook.sh`는 같은 패턴 해석 규칙으로 manual `gh pr create` 또는 command drift를 보정하는 fallback으로 남긴다.

**이유**: 실제 회귀는 “문서상으로는 전환되어야 하지만 실제 상태가 남는” 상황이다. command와 hook의 기준이 다르면 같은 PR에 대해 결과가 달라질 수 있으므로, 둘 다 동일한 closing keyword 해석 규칙을 따라야 한다.

**대안 고려**:
- hook만 강화: `/gh-pr` 문서 계약이 여전히 약하다.
- command만 강화하고 hook은 그대로 둔다: manual `gh pr create` 경로와 fallback 경로가 drift한다.

### D5: Board view contract는 Project와 문서 양쪽에 동일하게 반영한다

**결정**: `docs/pm-board.md`를 실제 운영 계약 문서로 유지하되, Active Sprint, Triage, Roadmap view의 필터/그룹 기준을 스펙으로 명시해 Project UI와 docs가 동시에 같은 구성을 목표로 하게 한다.

**이유**: acceptance criteria는 문서가 실제를 반영하거나 Project가 문서를 따르라고 말하지만, 운영 측면에서는 둘 다 맞아야 한다. “둘 중 하나”를 허용하면 drift를 다시 정당화하게 된다.

**대안 고려**:
- docs만 업데이트: Project UI가 계속 다르면 사용자가 UI에서 다른 동작을 본다.
- UI만 업데이트: 문서가 낡으면 자동화 계약을 읽을 때 오해가 남는다.

## Risks / Trade-offs

- **[Risk] `addSubIssue` GraphQL mutation이 권한 또는 API 제약으로 실패할 수 있음** → 경고 후 계속 진행하고, body의 `Parent epic: #N`를 portable fallback으로 유지한다.
- **[Risk] `gh project item-list` 조회 타이밍 문제로 newly added item을 바로 못 찾을 수 있음** → 재시도 로직과 충분한 `--limit`을 사용한다.
- **[Risk] custom `epic` field를 즉시 제거하지 못할 수 있음** → 문서와 spec에서 명시적으로 deprecated/unused 상태를 선언해 운영 기준을 먼저 고정한다.
- **[Risk] closing reference 해석 규칙을 넓히면 잘못된 issue까지 상태가 변할 수 있음** → `Closes`/`Fixes`/`Resolves` keyword references만 대상으로 제한하고 일반 `#N` 언급은 무시한다.
- **[Trade-off] `/gh-issue`와 `/gh-pr` 템플릿이 더 길어진다** → 대신 issue/PR 생성 직후의 Project state가 deterministic해진다.

## Migration Plan

1. `docs/pm-board.md`와 관련 spec에서 epic/view contract를 먼저 고정한다.
2. `/gh-issue` 템플릿을 갱신해 Backlog/Priority/native sub-issue linkage를 명시적으로 수행하게 한다.
3. `/gh-pr` 템플릿과 `pm-hook.sh`를 같은 closing reference 규칙으로 정렬한다.
4. GraphQL sub-issue linkage와 linked issue `"In Review"` 전환의 warn-not-fail 회귀 케이스를 검증한다.

별도의 데이터 마이그레이션은 필요하지 않지만, existing Project items 중 Priority나 Status가 비어 있는 항목은 별도 hygiene 작업이 필요할 수 있다.

## Open Questions

- 없음. 이 change는 issue #30의 acceptance criteria에 따라 native epic relationship, explicit Project field sync, warn-not-fail linkage 정책을 확정한다.
