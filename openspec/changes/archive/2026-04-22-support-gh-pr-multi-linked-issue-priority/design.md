## Context

`/gh-pr`의 현재 프롬프트는 step 9에서 "여러 linked issue의 priority가 다르면 가장 높은 priority를 사용한다"는 정책을 이미 언급하지만, step 8은 여전히 단일 `Closes #N`만 추출하는 흐름으로 적혀 있다. 그 결과 커맨드 템플릿, `scripts/pm-hook.sh` fallback, 그리고 스펙 시나리오가 모두 단일 linked issue 기준으로 갈라져 있으며, multi-issue PR에서 어떤 이슈를 기준으로 상태를 바꾸고 priority를 상속해야 하는지 결정 경로가 없다.

이 change는 새로운 PM 자동화 축을 도입하는 작업이 아니라, 기존 `/gh-pr` 동작을 다중 linked issue 입력에 대해 일관되게 만드는 정합성 수정이다. 영향 범위는 slash command 문서, fallback hook, 그리고 관련 스펙이다.

## Goals / Non-Goals

**Goals:**
- `/gh-pr`가 PR 본문에서 모든 `Closes`/`Fixes`/`Resolves` 이슈 참조를 추출하도록 요구사항을 명확히 한다.
- status 업데이트와 priority 상속이 같은 linked issue 집합을 사용하도록 정리한다.
- 서로 다른 priority가 섞인 경우에도 단일하고 결정적인 정책으로 PR priority를 계산하게 한다.
- 다중 linked issue 시나리오를 스펙에 추가해 이후 템플릿/스크립트 수정 시 회귀를 막는다.

**Non-Goals:**
- 새로운 label namespace 또는 Project field를 도입하지 않는다.
- cross-repo issue reference, full GitHub autolink 문법 전체를 지원 범위로 넓히지 않는다.
- PR 본문 작성 방식 자체를 바꾸지 않는다. 사용자는 계속 `Closes #N`, `Fixes #N`, `Resolves #N` 형태를 사용한다.

## Decisions

### D1: Linked issue를 단일 값이 아닌 "순서 보존 + 중복 제거된 목록"으로 취급한다

**결정**: `/gh-pr`는 PR 본문에서 closing keyword로 참조된 이슈 번호를 모두 수집하고, 본문 등장 순서를 유지하되 중복 번호는 한 번만 남긴 목록으로 취급한다.

**이유**: priority 계산과 issue status 업데이트가 서로 다른 파서나 다른 기준을 사용하면 다시 모순이 생긴다. ordered unique list를 공통 입력으로 정의하면 downstream 단계가 모두 같은 해석을 공유한다.

**대안 고려**:
- 첫 번째 이슈만 사용: 현재 모순을 그대로 유지한다.
- 마지막 이슈만 사용: 사용자 입장에서 예측 가능성이 낮다.
- 중복 포함 원본 배열 사용: 상태 업데이트와 label 계산에서 불필요한 중복 작업이 생긴다.

### D2: Priority 해석은 "가장 높은 priority wins"로 고정한다

**결정**: linked issue 집합에서 발견된 `p0`/`p1`/`p2` 중 가장 높은 값을 PR priority로 사용한다. 우선순위는 `p0 > p1 > p2`이며, 어떤 linked issue에도 priority가 없으면 `p1`을 적용한다.

**이유**: issue #29의 acceptance criteria와 현재 프롬프트 문구가 이미 highest-wins 방향을 시사한다. 또한 여러 이슈를 함께 닫는 PR은 보통 가장 긴급한 트래킹 관점에 맞춰 분류하는 편이 backlog triage와 리뷰 우선순위에 더 안전하다.

**대안 고려**:
- 첫 번째 linked issue의 priority 사용: 본문 순서라는 우연한 요소에 결과가 좌우된다.
- 가장 낮은 priority 사용: 긴급 이슈가 PR에서 희석될 수 있다.
- priority 충돌 시 사용자 입력 요구: `/gh-pr`의 자동화 흐름을 불필요하게 끊는다.

### D3: Linked issue status 업데이트도 동일한 목록 전체에 적용한다

**결정**: PR 생성 후 Project "In Review" 상태로 옮기는 단계는 첫 번째 linked issue만이 아니라, 파싱된 모든 linked issue에 대해 반복 적용한다.

**이유**: step 8을 다중 issue 파싱으로 바꾸면서 status 처리를 그대로 단수로 남기면 command flow가 다시 분기된다. "linked issues" 목록을 만들었다면 status와 priority 모두 그 목록을 소비해야 설명이 일관된다.

**대안 고려**:
- status는 첫 번째 issue만, priority만 전체 사용: 구현은 단순해 보여도 사용자 기대와 문서가 어긋난다.
- status 단계는 그대로 두고 spec에서만 priority 정책 추가: 현재 이슈의 모순을 절반만 해결한다.

### D4: Fallback hook도 command spec과 같은 정책을 따라야 한다

**결정**: `scripts/pm-hook.sh`의 fallback 동작 역시 다중 linked issue 목록을 동일하게 해석해야 하며, command template과 다른 우선순위 규칙을 두지 않는다.

**이유**: 이 저장소는 `/gh-pr` 직접 처리와 hook fallback의 이중 방어 구조를 사용한다. 두 경로가 다른 priority 결과를 내면 idempotent fallback이 아니라 drift source가 된다.

**대안 고려**:
- hook은 단일 issue 유지: manual `gh pr create` 경로에서 결과가 달라진다.
- hook은 priority만 맞추고 status는 단일 issue 유지: 두 자동화 경로가 다시 어긋난다.

## Risks / Trade-offs

- **[Risk] PR 본문 파싱 복잡도 증가** → closing keyword 범위를 `Closes`/`Fixes`/`Resolves`와 같은 기존 패턴으로 제한하고, 다중 reference는 그 반복으로만 해석한다.
- **[Risk] 여러 linked issue를 모두 In Review로 옮기면 예상보다 넓게 상태가 변할 수 있음** → closing keyword가 명시된 issue만 대상으로 하고, 일반 `#N` 언급은 무시한다.
- **[Risk] 기존 hook/템플릿/테스트가 단일 issue 가정을 갖고 있을 수 있음** → spec과 tasks에서 command template, hook, 시나리오 테스트를 함께 갱신 대상으로 묶는다.
- **[Trade-off] command 문구와 구현 단계가 조금 길어진다** → 대신 priority/status 정책이 명확해져 운영 ambiguity가 줄어든다.

## Migration Plan

문서와 자동화 로직을 함께 갱신하는 변경이므로 별도 데이터 마이그레이션은 없다. 배포 순서는 `/gh-pr` 템플릿 갱신, fallback hook 동기화, multi-linked-issue 시나리오 검증 순으로 진행한다.

## Open Questions

- 없음. 이 change는 issue #29 acceptance criteria에 맞춰 highest-wins 정책을 확정한다.
