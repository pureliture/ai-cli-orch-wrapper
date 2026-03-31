# Memo: wrapper + GSD 작업 루틴

## 목적

`wrapper`를 세션 진입점과 다중 CLI 검토 레이어로 사용하고, 실제 작업 상태 관리와 phase 진행은 `GSD`가 담당하는 운영 루틴을 정리한다.

현재 기준 권장 역할 분리는 다음과 같다.

- `wrapper`: provider alias 실행, role 기반 workflow 실행, planner/reviewer 다중 CLI 검토
- `GSD`: discuss → plan → execute → verify → complete 흐름 관리

## 기본 진입 루틴

1. 최초 머신 세팅 시 `wrapper setup`
2. 작업 시작 시 `wrapper codex`
3. 세션 안에서 `$gsd-next` 또는 필요한 `gsd-*` 명령 실행
4. 계획/검증 경계에서만 `wrapper workflow plan-review` 사용

핵심 원칙:

- 다중 CLI는 항상 artifact 기반으로 끼운다
- 토론 초반에는 다중 CLI를 넣지 않는다
- 요약은 handoff 용도이고, 승인 게이트 대체 수단이 아니다

## 권장 작업 흐름

### 1. Discuss 단계

권장:

- `gsd-discuss-phase`
- 또는 이미 방향이 명확하면 discuss 생략 후 바로 plan

이 단계에서는 다중 CLI를 넣지 않는다.
이유는 아직 문제 정의가 흔들리는 시점이라, reviewer를 추가하면 잡음이 늘고 결정 속도만 떨어질 가능성이 크기 때문이다.

### 2. Plan 단계

권장:

1. `gsd-plan-phase <phase>`
2. PLAN.md 산출물 확인
3. `wrapper workflow plan-review`

여기서 다중 CLI의 역할은 "요약"이 아니라 "독립 검토"다.
검토 포인트는 다음에 둔다.

- 요구사항 누락이 있는가
- phase 분해가 너무 크거나 너무 잘게 쪼개졌는가
- 검증 계획이 비어 있는가
- 위험한 가정이나 숨은 의존성이 있는가

즉, 첫 번째 핵심 개입 시점은 `plan 직후`다.

### 3. Execute 단계

권장:

- `gsd-execute-phase <phase>`

실행 도중에는 `wrapper workflow plan-review`를 반복 호출하지 않는다.
대신 필요할 때만 좁은 질문으로 다른 CLI를 직접 호출한다.

예시:

- `wrapper claude`로 설계 선택 검토
- `wrapper gemini`로 테스트 누락 점검
- `wrapper codex`로 구현 경로 비교

즉 execute 중 다중 CLI는 "전체 리뷰 루프"보다 "bounded consultation"에 가깝게 쓴다.

### 4. Verify 단계

권장:

1. `gsd-verify-work`
2. 필요하면 `wrapper workflow plan-review` 또는 별도 reviewer 세션으로 최종 검토

이 시점의 검토 목적:

- 요구사항 미충족 여부
- 회귀 가능성
- 테스트 부족
- 운영상 리스크

즉, 두 번째 핵심 개입 시점은 `verify 직전/직후`다.

## 요약을 다중 CLI에 맡길 때의 위치

요약은 유용하지만, 주 용도는 승인 게이트가 아니라 handoff / context compression 이다.

좋은 사용처:

- 긴 PLAN.md를 다음 세션용 checkpoint로 압축
- SUMMARY.md / VERIFICATION.md를 짧게 재정리
- phase 종료 후 "결정 / 리스크 / 남은 일" 1페이지 메모 생성

좋지 않은 사용처:

- 원문 PLAN.md 대신 요약본만 reviewer에게 넘기기
- 요약본만 보고 승인 / 기각 결정하기

원칙:

- 검토는 원문 artifact 기준
- 요약은 세션 절약과 handoff 기준

## 추천 운영 패턴

가장 안정적인 기본 루틴:

1. `wrapper codex`
2. `$gsd-next`
3. `gsd-discuss-phase <phase>` 또는 생략
4. `gsd-plan-phase <phase>`
5. `wrapper workflow plan-review`
6. 승인되면 `gsd-execute-phase <phase>`
7. 구현 도중 필요 시 `wrapper claude` / `wrapper gemini`로 좁은 자문
8. `gsd-verify-work`
9. 필요 시 최종 reviewer 검토

## 운영 메모

- 다중 CLI의 본업은 요약이 아니라 독립 검토다
- `plan-review`는 `plan 직후`와 `verify 직전/직후`가 가장 효율적이다
- execute 중에는 전체 review loop보다 개별 자문 호출이 낫다
- 현재 v1.0 wrapper workflow는 `approved` / `changes_requested` 중심의 단순 reviewer contract를 전제로 한다
- 향후 v1.3에서 rerun/resume, richer outcome, workspace-aware 실행이 붙으면 이 루틴은 더 자연스러워질 수 있다

---
*작성일: 2026-03-31*
*성격: 운영 메모 / 초안*
