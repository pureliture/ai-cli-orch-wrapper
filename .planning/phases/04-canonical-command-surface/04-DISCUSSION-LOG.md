# Phase 04: Canonical Command Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 04-canonical-command-surface
**Areas discussed:** 표시 이름 정책, 공식 실행 경로 정책, 구형 호출 복구 방식, 복구 메시지 톤, canonical command 이름

---

## 표시 이름 정책

| Option | Description | Selected |
|--------|-------------|----------|
| `wrapper`만 노출 | 사용자-facing 런타임 텍스트는 `wrapper`만 사용 | ✓ |
| `wrapper` 우선 + repo/package 이름 보조 표기 | 예: `wrapper (ai-cli-orch-wrapper)` | |
| 혼용 허용 | 기존 문자열과 새 문자열이 섞여도 허용 | |

**User's choice:** `wrapper`만 노출
**Notes:** 이후 사용자가 canonical command 자체를 바꾸기로 하면서, 이 결정의 실질적 의미는 "`aco`만 노출"로 승계됨.

---

## 공식 실행 경로 정책

| Option | Description | Selected |
|--------|-------------|----------|
| 공식 surface는 command 하나만 사용 | raw entrypoint는 개발/테스트용만 허용 | ✓ |
| command와 `node dist/cli.js`를 둘 다 공식 경로로 인정 | 둘 다 문서에 남김 | |
| command가 기본이지만 raw 경로도 일부 공개 | 혼합 surface 유지 | |

**User's choice:** 공식 public surface는 command 하나만 사용
**Notes:** 이후 canonical command가 `aco`로 바뀌었으므로, 공식 경로도 `aco` 하나로 해석된다.

---

## 구형 호출 복구 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 바로 실패시키고 새 command를 안내 | 묵시적 호환 없이 canonical path로 복귀 | ✓ |
| 임시 호환 경로를 두고 경고만 출력 | gradual migration 지원 | |
| 상황별 혼합 | 일부 redirect, 일부 hard fail | |

**User's choice:** 바로 실패시키고 새 command를 안내
**Notes:** 이후 사용자는 `wrapper` compatibility alias도 남기지 말라고 명시했다.

---

## 복구 메시지 톤

| Option | Description | Selected |
|--------|-------------|----------|
| 짧고 직접적 | "Use `<command>`." + 다음 행동 1개 | ✓ |
| 설명형 | 변경 이유 1문장 + 다음 행동 1개 | |
| 상세 가이드형 | 가능한 원인과 예시를 길게 출력 | |

**User's choice:** 짧고 직접적
**Notes:** 복구 메시지는 terse style을 유지하고, 상황별 단일 next-step example만 허용한다.

---

## Canonical command 이름

| Option | Description | Selected |
|--------|-------------|----------|
| `wrapper` 유지 | 기존 command를 계속 canonical name으로 사용 | |
| 새 canonical name으로 전면 교체 | 기존 command를 완전히 버리고 새 이름으로 통일 | ✓ |
| 병행 전환 | 일정 기간 두 이름을 함께 유지 | |

**User's choice:** `aco`
**Notes:** "기존 wrapper를 남기지 말고, 옛 이름을 모두 찾아서 모두 새로운 이름으로 치환. 깨끗하게 전환하는 것이 목표. 아예 남기지 않고." 라고 명시했다.

---

## the agent's Discretion

- stale invocation detection implementation details
- error context별 단일 next-step example 선택

## Deferred Ideas

- `.wrapper.json`, `.wrapper/`, `wrapper.lock` 같은 repo-local contract rename은 Phase 05 runtime contract 작업에서 이어서 처리
- command surface 바깥의 광범위한 identity cleanup은 후속 정리 대상으로 추적
