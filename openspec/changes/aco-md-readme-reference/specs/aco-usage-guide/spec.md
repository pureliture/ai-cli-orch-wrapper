## ADDED Requirements

### Requirement: ACO.md 사용 가이드 문서

repo root에 `ACO.md`가 존재해야 하며(SHALL), aco CLI의 주요 서브커맨드, consent-gated 위임 흐름(`aco ask --dry-run` 후 `--yes`), 지원 provider 전체(`codex`/`antigravity`/`mock`, 기본값 `mock`), 그리고 사용 시 주의사항을 담아야 한다(SHALL). 가이드 내용은 현재 브랜치의 실제 aco 동작과 일치해야 한다(MUST).

#### Scenario: ACO.md가 핵심 사용법을 담는다
- **WHEN** repo root의 `ACO.md`를 연다
- **THEN** aco 주요 서브커맨드, consent-gated 위임 흐름, 지원 provider 전체(`codex`/`antigravity`/`mock`)와 기본값(`mock`), 주의사항 섹션이 모두 존재한다

#### Scenario: 가이드가 실제 CLI 동작과 일치한다
- **WHEN** `ACO.md`에 기술된 서브커맨드·위임 플래그·provider 목록을 현재 브랜치 aco(`aco ask --help`, registry)와 대조한다
- **THEN** 문서에 존재하지 않거나 폐기된 명령/플래그/provider가 없다

#### Scenario: Codex self-delegation caveat가 명시된다
- **WHEN** Codex 세션에서 `aco ask --providers codex`로 codex를 호출하는 경우의 안내를 읽는다
- **THEN** self-delegation(재귀) 위험과 권장 회피(다른 peer로 위임)가 caveat로 기술되어 있다

### Requirement: README 참조 설정 안내

`README.md`는 각 CLI guideline 문서에서 `ACO.md`를 참조하도록 설정하는 방법을 안내해야 한다(SHALL). 안내는 Claude, Codex, Antigravity 세 provider 각각의 참조 위치와 메커니즘을 명시해야 한다(MUST).

#### Scenario: README가 provider별 참조 방법을 안내한다
- **WHEN** `README.md`의 ACO.md 참조 안내 섹션을 읽는다
- **THEN** Claude는 `~/.claude` 경로의 `@ACO.md` import, Codex는 project root `AGENTS.md` 명시 참조, Antigravity는 user-level `~/.gemini/GEMINI.md` 참조로 각각 기술되어 있다

#### Scenario: @-import 한계가 명시된다
- **WHEN** Codex/Antigravity 참조 안내를 읽는다
- **THEN** `@`-import는 Claude Code 고유 기능이며 Codex/agy는 명시 텍스트 참조를 사용한다는 점이 안내되고, Codex 참조에는 복사-붙여넣기용 표준 문구 예시가 포함된다

### Requirement: Claude 참조 경로 안전성 안내

README의 Claude 안내는 `@ACO.md`가 참조 파일이 실제 존재하는 경로에서만 해석된다는 점을 명시해야 한다(SHALL). repo root `ACO.md`가 임의 프로젝트에서 자동 resolve되지 않으므로, user-level 전역 참조를 원할 경우 `~/.claude/ACO.md` 사본 또는 절대경로(`@/abs/path/ACO.md`) 사용을 안내해야 한다(SHALL).

#### Scenario: 전역 참조 경로 안전 안내
- **WHEN** Claude 참조 안내를 읽는다
- **THEN** `~/.claude/CLAUDE.md`의 `@ACO.md`가 ACO.md 미존재 프로젝트에서 깨질 수 있다는 경고와, `~/.claude/ACO.md` 사본 또는 절대경로 대안이 함께 제시된다

### Requirement: Antigravity 참조는 user-level GEMINI.md 우선

README의 Antigravity 안내는 `~/.gemini/GEMINI.md`(global rules, 전 workspace 적용)를 1순위 참조 위치로 제시해야 한다(SHALL). 이 repo가 `GEMINI.md`를 `aco sync` 생성 대상에서 제거했으므로 project root `GEMINI.md`는 권장하지 않으며(SHALL NOT 권장), 기존 workspace 정책이 있을 때만 쓰는 caveat 대안으로만 명시해야 한다(SHALL). `.agents/rules/`도 대안으로 명시할 수 있다.

#### Scenario: agy 안내가 user-level을 1순위로 둔다
- **WHEN** Antigravity 참조 안내를 읽는다
- **THEN** `~/.gemini/GEMINI.md`가 1순위로 제시되고, project root `GEMINI.md`는 권장이 아닌 caveat 대안으로만 표기된다

### Requirement: context-sync 문서 정합은 sync target 미추가

`docs/reference/context-sync.md`의 "agy AGENTS.md 미지원" 문구는 "agy가 로컬 `AGENTS.md`/`GEMINI.md`를 파싱하나 `aco sync` 자동 생성 대상에서만 제외된다(hand-maintained)"는 의미로 보강해야 한다(SHALL). 이 보강은 새 `aco sync` 생성 target을 추가하지 않으며 manual/runtime reference caveat 문구에 한정해야 한다(SHALL NOT 새 target 추가).

#### Scenario: 문서 정합이 sync target을 늘리지 않는다
- **WHEN** `context-sync.md` 보강 후 sync 대상 목록을 확인한다
- **THEN** "sync 비생성 vs CLI capability" 구분 문구만 추가되고 새 sync 생성 target은 없다

### Requirement: 명령어·sync 자동화 미추가

이 변경은 새 slash/CLI 명령어를 추가하지 않아야 하며(SHALL NOT), `ACO.md` 참조를 위한 `aco sync` managed block이나 생성 target을 추가하지 않아야 한다(SHALL NOT). 참조는 사람이 직접 편집하는 surface에만 적용된다.

#### Scenario: command/sync source 무변경 (allowlist diff gate)
- **WHEN** 변경 후 `packages/wrapper/src/cli.ts`, `packages/wrapper/src/commands/`, `packages/wrapper/src/sync/`, `.claude/commands/`, `templates/commands/`, `.agents/skills/`, `.codex/agents/`의 diff를 확인한다
- **THEN** 위 경로에 변경이 없다(문서 외 surface 무변경)

#### Scenario: ACO.md/README가 sync target에 미등록
- **WHEN** `.aco/sync.yaml`과 `aco sync` 대상 목록을 정적으로 대조한다
- **THEN** `ACO.md`와 `README.md`가 sync 생성/관리 target에 포함되어 있지 않다

#### Scenario: sync 무회귀
- **WHEN** 변경 적용 후 `aco sync --check`(가능하면 `--strict`)를 실행한다
- **THEN** stale/conflict 없이 통과한다(exit 0)
