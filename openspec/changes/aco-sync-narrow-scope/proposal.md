## Why

`aco sync`는 구조적 표면 변환(agents/skills/hooks)뿐 아니라 `CLAUDE.md`를 `AGENTS.md`의 generated context block으로 투영하는 freeform guideline/instruction markdown까지 생성한다. 이 때문에 Claude의 source-of-truth 파일이 Codex 전용 진입점(`$aco`, `$gh-*`) 같은 provider-native 산문을 대신 들고 있어야 하고, provider별 지침이 단일 파일에 뒤섞이며 sync 책임 경계가 흐려진다. `GEMINI.md` 타깃은 이미 마이그레이션으로 제거되어, 같은 방향의 정리가 자연스럽다.

## What Changes

- **BREAKING (sync contract)**: `aco sync` 범위에서 guideline/instruction markdown 투영(`CLAUDE.md` → `AGENTS.md`의 `<!-- BEGIN ACO GENERATED CONTEXT -->` managed block)을 제거한다.
- `AGENTS.md`를 generated target에서 분리해 **hand-maintained peer 문서**로 전환한다. sync는 이 파일을 더 이상 **생성·감지·기록하지 않는다**(target set에서 완전 제외). 기존 repo의 관리 블록 마커는 사람이 **1회 수동 제거**한다(sync 기능 아님).
- `aco sync`는 **구조적 표면 변환만** 책임진다: `.claude/agents → .codex/agents`, 공유 skills → `.agents/skills`, hooks → `.codex/hooks.json`·`.codex/config.toml`.
- manifest는 줄어든 target set 기준으로 재생성되어 `AGENTS.md`/`GEMINI.md` 키가 **자연히 빠진다**(별도 prune/감지 로직 없음). `--check`/`--strict`는 target만 검사하므로 `AGENTS.md`는 애초에 대상이 아니다.
- provider-native 가이드 소유권 이전: Codex `$aco`/`aco delegate` 진입점 문서는 `AGENTS.md`(손유지)와 `.codex/skills/aco/`(일급 스킬)가 소유한다. root `CLAUDE.md`의 `## Codex $aco Entrypoint` 절은 Claude 시점만 남기고 Codex-native 내용은 `AGENTS.md`로 이전한다. (기존 이슈 #145 흡수.)
- `docs/reference/context-sync.md` 등 관련 문서를 새 책임 경계에 맞게 갱신한다.

## Capabilities

### New Capabilities
<!-- 신규 capability 없음 — 기존 capability 축소 + 문서 소유권 이전 -->

### Modified Capabilities
- `context-sync`: "Project guidance generation"(`AGENTS.md`/`GEMINI.md` 생성, managed block refresh) requirement를 **제거**한다. source discovery, shared skill sync, Codex custom agent generation, hook sync는 그대로 유지한다.
- `cli-sync-command`: `--check`/`--strict`/`--force`/dry-run 동작에서 `AGENTS.md` context 타깃을 대상에서 제외하도록 수정한다(구조적 표면 타깃만 검사·생성).

## Impact

- 코드: `packages/wrapper/src/sync/` — `context-transform.ts`·`managed-block.ts`에서 `AGENTS.md`/`GEMINI.md` 생성 경로 **삭제**, `sync-engine.ts` 타깃 집합 축소, `manifest.ts`는 줄어든 target set으로 재생성(별도 마이그레이션 로직 없음).
- 산출물/문서: `AGENTS.md`(generated block 제거 → 손유지, 마커는 이 repo에서 1회 손제거), root `CLAUDE.md`(`## Codex $aco Entrypoint` 절 정리), `docs/reference/context-sync.md`.
- provider 표면: `.codex/skills/aco/`(신규 일급 스킬, 이슈 #145 흡수 — `aco ask` + `aco delegate` 진입점).
- 테스트/CI: `aco sync --check --strict` 기대값, context-sync fixtures.
- 호환성: 기존 repo의 inert 마커(`<!-- BEGIN/END ACO GENERATED CONTEXT -->`)는 무해한 HTML 주석이라 방치해도 됨. sync는 이를 자동 편집·감지하지 않는다.
