## Why

aco는 Claude / Codex / Antigravity(agy)를 한 wrapper로 묶지만, 각 CLI가 `aco`를 어떻게 호출·위임하는지에 대한 단일 사용 가이드가 없다. 사용자는 provider별로 호출 방식을 따로 익혀야 한다. 사용자 전역 `CLAUDE.md`가 `@RTK.md`로 rtk 사용법을 끌어오듯, aco 사용법을 담은 단일 `ACO.md`를 만들고 각 CLI guideline이 이를 참조하게 하면 학습 비용이 사라진다.

## What Changes

- repo root에 aco 사용 가이드 `ACO.md`를 신설한다. aco 주요 서브커맨드, consent-gated 위임 흐름(`aco ask --dry-run` → `--yes`), 지원 provider 전체(`codex`/`antigravity`/`mock`, 기본값 `mock`), Codex 세션이 codex provider를 호출하는 self-delegation 재귀 caveat, 주의사항을 담는다.
- README에 "각 CLI guideline에서 ACO.md를 참조하는 방법"을 안내하는 섹션을 추가한다. provider별 참조 위치와 메커니즘을 문서화한다:
  - Claude: user `~/.claude/CLAUDE.md`에서 `@ACO.md`를 쓰려면 ACO.md가 해당 참조 경로에 실제 존재해야 한다. repo root ACO.md는 임의 프로젝트에서 자동 resolve되지 않으므로, (a) `~/.claude/ACO.md`로 사본을 두고 `@ACO.md`, 또는 (b) 절대경로 `@/abs/path/ACO.md`를 안내한다. project root `CLAUDE.md`에서 `@ACO.md`는 그 repo 안에서만 안전하다는 한계를 경고한다.
  - Codex: project root `AGENTS.md`(hand-maintained)에 ACO.md 명시 텍스트 참조를 1순위로 안내하고, 복사-붙여넣기용 표준 문구 예시를 제공한다. user `~/.codex/AGENTS.md` 전역 로딩은 검증 전까지 선택 대안으로 둔다.
  - Antigravity(agy): user-level `~/.gemini/GEMINI.md`(global rules, 전 workspace 적용, knowledge 검증됨)에 ACO.md 참조를 1순위로 고정한다. 이 repo는 `GEMINI.md`를 sync 생성 대상에서 제거했으므로 project root `GEMINI.md`는 권장하지 않고, 기존 workspace 정책이 있을 때만 쓰는 caveat 대안으로 강등한다. `.agents/rules/`도 대안으로 명시한다.
- 새 slash/CLI 명령어를 추가하지 **않는다**. `aco sync` 자동화/managed block을 추가하지 **않는다**(README 안내 전용).
- 참조 추가가 sync 비대상 surface(AGENTS.md 등)에만 닿으므로 `aco sync --check`에 회귀가 없음을 보장한다.

## Capabilities

### New Capabilities
- `aco-usage-guide`: aco 사용법을 담은 `ACO.md` 문서와, 각 CLI guideline(Claude/Codex/Antigravity)에서 그 문서를 참조하도록 설정하는 README 안내. 명령어·sync 자동화 없이 문서와 수동 참조 설정만 정의한다.

### Modified Capabilities
<!-- 없음 — 기존 spec의 요구사항 변경 없음. aco-v2-spec은 runtime/delegation 계약이라 본 문서-surface 추가와 무관. -->

## Impact

- 신규 파일: root `ACO.md`.
- 수정 파일: `README.md`(참조 안내 섹션 추가). 정합 확인용으로 `docs/reference/context-sync.md`의 "agy AGENTS.md 미지원" 문구가 manual-reference 맥락과 혼동되지 않게 보강(sync 비생성 vs CLI capability 구분).
- 코드 변경 없음: wrapper runtime, provider 구현, `aco sync` 엔진, 명령어 surface는 그대로다.
- 외부 영향: 사용자가 자기 환경의 user-level guideline 파일을 수동 편집하도록 안내(README). repo가 사용자 홈을 자동 수정하지 않는다.
