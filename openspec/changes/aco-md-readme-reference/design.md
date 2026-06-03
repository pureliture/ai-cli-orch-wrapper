## Context

aco는 provider-neutral wrapper로 Claude / Codex / Antigravity(agy)를 묶지만, "각 CLI에서 aco를 어떻게 쓰는가"를 담은 단일 사용 가이드가 없다. 사용자 전역 `CLAUDE.md`의 `@RTK.md` 패턴(rtk 사용법을 user-level guideline이 import)을 aco에도 적용하려 한다.

현재 surface 사실(머지된 main 기준, `docs/reference/context-sync.md` + routine-harness Antigravity knowledge):
- `AGENTS.md`는 #150 이후 `aco sync`가 생성/관리하지 않는 hand-maintained peer 문서다.
- Antigravity(agy)는 GEMINI.md/AGENTS.md를 실제로 읽는다: user-level `~/.gemini/GEMINI.md`(global rules, 전 workspace), workspace root `GEMINI.md`/`AGENTS.md`(startup 파싱), `.agents/rules/`. 저장소 문서의 "agy AGENTS.md 미지원"은 `aco sync`가 agy용 target을 생성하지 않는다는 sync-파이프라인 진술이지 CLI capability가 아니다.
- `@`-import는 Claude Code 고유 기능이다.

제약: 사용자 요청상 (1) 명령어를 추가하지 않는다, (2) `aco sync` 자동화를 추가하지 않는다(README 안내 전용), (3) repo가 사용자 홈을 자동 수정하지 않는다.

## Goals / Non-Goals

**Goals:**
- root `ACO.md` 단일 사용 가이드 신설.
- README에 provider별 ACO.md 참조 설정 방법 문서화(Claude/Codex/Antigravity).
- 참조 모델이 실제 CLI 동작과 일치하고 `aco sync`에 회귀를 주지 않음을 보장.

**Non-Goals:**
- 새 slash/CLI 명령어, `aco sync` managed block/생성 target.
- repo가 사용자 user-level 파일(`~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md` 등)을 자동 편집/설치하는 기능.
- aco runtime/provider/delegation 동작 변경.

## Decisions

### ADR-1: ACO.md 참조를 sync managed block이 아니라 README 수동 안내로 제공

**Context**: 각 CLI guideline이 ACO.md를 참조하게 하는 방법은 (A) `aco sync`가 managed block을 생성·주입, (B) README가 사람이 직접 편집하도록 안내, 두 갈래다.

| 차원 | A: sync managed block | B: README 수동 안내 |
|------|----------------------|---------------------|
| 복잡도 | High (sync 엔진·manifest·target 확장) | Low (문서만) |
| 사용자 요청 부합 | 위반(자동화 추가) | 부합 |
| user-level surface 도달 | 불가(sync는 project-scoped) | 가능(`~/.claude`, `~/.gemini`) |
| 회귀 위험 | sync contract 변경 위험 | 코드 무변경 |

**Decision**: B. `@RTK.md`가 user-level `~/.claude/CLAUDE.md`에서 동작하듯, ACO.md 참조는 본질적으로 user-level 설정이고 sync(project-scoped)로는 도달할 수 없다. 사용자도 명령어·sync 추가를 명시적으로 배제했다.

**Alternatives 기각**: A는 sync가 닿지 못하는 user-level surface가 핵심이라 부적합하고, AGENTS.md는 애초에 sync 비대상(hand-maintained)이라 managed block을 둘 수 없다.

### ADR-2: provider별 참조 위치를 capability에 맞춰 분기

**Decision**:
- Claude → `~/.claude/CLAUDE.md` `@ACO.md`. 단 ACO.md가 참조 경로에 실제 존재해야 하므로 `~/.claude/ACO.md` 사본 또는 절대경로를 안내(ADR-4 참조).
- Codex → project root `AGENTS.md`(hand-maintained) 명시 텍스트 참조 1순위 + 복사용 표준 문구. user `~/.codex/AGENTS.md` 전역 로딩은 미검증이라 선택 대안.
- Antigravity → user-level `~/.gemini/GEMINI.md`(global rules) 명시 참조 1순위. project root `GEMINI.md`는 이 repo가 sync 제거했으므로 권장하지 않고 caveat 대안으로 강등. `.agents/rules/`도 대안.

**Rationale**: `@`-import는 Claude 전용이라 Codex/agy엔 적용 불가 → 명시 텍스트 참조. agy의 global rules 위치가 `~/.gemini/GEMINI.md`(knowledge 검증: routine-harness rules-workflows.md, gcli-migration.md)라 전 workspace 적용 가능. 지원 provider registry는 `codex`/`antigravity`/`mock`(기본 `mock`)이므로 ACO.md는 셋 모두를 표기하고, Codex 세션이 codex를 호출하는 self-delegation 재귀는 caveat로 분리한다.

**Alternative 기각**: "모든 provider에 `@import` 통일"은 Codex/agy가 그 문법을 지원하지 않아 무효. "project root `GEMINI.md` 권장"은 repo가 GEMINI.md를 sync 비대상으로 제거한 현 상태와 충돌해 사용자를 오도하므로 기각.

### ADR-4: Claude 전역 참조는 경로 명시(사본/절대경로)로 안전화

**Context**: `~/.claude/CLAUDE.md`의 `@ACO.md`는 활성 workspace root 기준 상대 resolve라, repo root ACO.md를 가리키리라는 보장이 없고 ACO.md 없는 다른 프로젝트에서 로드 실패할 수 있다(두 리뷰어 공통 P1).

**Decision**: README는 전역 참조 시 (a) `~/.claude/ACO.md` 사본 + `@ACO.md`, 또는 (b) 절대경로 `@/abs/path/ACO.md`를 안내하고, project `CLAUDE.md`의 `@ACO.md`는 해당 repo 내에서만 안전하다는 한계를 경고한다.

**Trade-off**: 사본/절대경로는 ACO.md 갱신 시 동기화 부담이 있으나, 깨진 참조보다 안전. RTK.md(`~/RTK.md`)와 동일한 user-level 사본 관례.

### ADR-3: ACO.md를 user-level 가이드 문서로 취급하고 배치 경로를 README에 안내

**Decision**: ACO.md는 repo에 작성하되, `@ACO.md`/명시 참조가 user-level guideline에서 해석되려면 경로가 필요하므로 README가 배치/경로(예: repo 참조 또는 `~/ACO.md` 사본) 안내를 포함한다. repo는 자동 복사하지 않는다.

**Trade-off**: 자동 설치가 없어 사용자가 한 번 수동 설정해야 한다(= RTK.md와 동일 UX). 단순성·범위 최소화를 위해 수용.

## Risks / Trade-offs

- [문서-실제 동작 드리프트] ACO.md가 aco 실제 서브커맨드와 어긋날 수 있음 → 검증 단계에서 현재 브랜치 aco와 대조(spec scenario), 향후 변경 시 ACO.md 동기 갱신을 maintenance note로 남김.
- [저장소 문서 모순] `context-sync.md`의 "agy AGENTS.md 미지원" 문구가 manual-reference 맥락과 충돌해 독자 혼동 → 해당 문구를 "sync 비생성 vs CLI capability" 구분으로 보강.
- [user-level 경로 의존] user-level guideline에서 repo의 ACO.md를 참조할 때 경로 깨짐 가능 → README가 권장 배치(사본/절대경로)와 한계를 명시.
- [범위 누수] 편의상 명령어/sync 자동화를 추가하려는 유혹 → Non-Goals와 spec의 "미추가" requirement로 차단. 추가로 allowlist diff gate(코드/명령/sync source 경로 무변경)와 ACO.md/README의 sync target 미등록 정적 대조로 적극 증명.
- [provider 목록 오기] 문서가 `antigravity`/`mock`만 적으면 실제 registry(`codex` 포함)와 어긋남 → ACO.md에 `codex`/`antigravity`/`mock`(기본 `mock`) 전체 표기 + Codex self-delegation 재귀 caveat.
- [전역 경로 미검증] Codex `~/.codex/AGENTS.md`, agy global path의 런타임 인식은 독립 재검증 전까지 불확실 → Codex는 project root `AGENTS.md`를 1순위로, agy는 knowledge 검증된 `~/.gemini/GEMINI.md`만 1순위로 두고 1회 spot check 권장.

## Testing Strategy

docs-only 변경이라 testing pyramid의 무게중심은 정적 검증(문서 계약)과 회귀 가드에 둔다.

- **정적/구조 검증(many, fast)**: `ACO.md` 존재 및 필수 섹션(서브커맨드·위임 흐름·peers·주의사항) 포함 확인. `README.md`의 참조 안내 섹션이 세 provider 경로/메커니즘을 모두 포함하는지 확인. grep 기반 체크로 충분.
- **회귀 가드(integration)**: `aco sync --check`(필요 시 `--strict`) 통과. 추가로 **allowlist diff gate** — `packages/wrapper/src/cli.ts`, `.../commands/`, `.../sync/`, `.claude/commands/`, `templates/commands/`, `.agents/skills/`, `.codex/agents/`에 변경이 없음을 `git diff`로 증명(소극적 통과를 넘어 적극적 무변경 증명). **적극적 제외 검증** — `.aco/sync.yaml`/sync 대상에 `ACO.md`/`README.md`가 미등록임을 정적 대조.
- **artifact schema gate**: `openspec validate aco-md-readme-reference --type change --strict` 통과 — docs-only라도 OpenSpec artifact 정합 유지.
- **정확성 대조(high-confidence)**: ACO.md에 적힌 서브커맨드/플래그를 현재 브랜치 `aco --help`/CLI usage와 대조해 폐기/오타 명령이 없는지 확인. agy 참조 경로가 knowledge(`~/.gemini/GEMINI.md` global rules)와 일치하는지 확인.
- **수동 동작 확인(few, e2e, 선택)**: 문서대로 설정 시 Claude `@ACO.md`가 로드되고 agy가 GEMINI.md를 파싱하는지 1회 스폿 체크. 자동화 비대상이라 회귀 스위트에는 넣지 않는다.
- **커버리지 타깃**: spec의 모든 scenario가 정적 체크 또는 회귀 명령으로 1:1 매핑. skip 대상: 산문 표현 스타일, 문서 포맷팅.

## Open Questions

- ACO.md 배치 권장안을 "repo 파일 직접 참조"로 할지 "`~/`로 사본 안내"로 할지 — README 작성 시 RTK.md 관례에 맞춰 확정(기본: 사용자가 자기 user-level guideline에서 참조 가능한 형태로 안내).
- `context-sync.md` 문구 보강을 본 change에 포함할지 별도 doc chore로 뺄지 — 현 범위에선 포함(혼동 제거가 본 기능의 정확성과 직결).
