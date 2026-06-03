## Context

`aco sync`는 Claude를 source-of-truth로 두고 다른 provider 표면을 파생시키는 엔진이다. 현재 책임은 두 종류가 섞여 있다.

1. **구조적 표면 변환** — 포맷/레이아웃이 실제로 바뀌는 변환: `.claude/agents → .codex/agents`(frontmatter 변환), 공유 skills → `.agents/skills`, hooks → `.codex/hooks.json`·`.codex/config.toml`(TOML managed block). codegen이 분명한 값을 한다.
2. **guideline markdown 투영** — `CLAUDE.md`(+선택 소스)를 `AGENTS.md`의 `<!-- BEGIN ACO GENERATED CONTEXT -->` managed block으로 복사/변환하는 freeform 산문 투영. `GEMINI.md`는 마이그레이션으로 이미 드롭됨.

(2)는 Claude의 SoT 파일이 Codex 전용 진입점(`$aco`, `$gh-*`) 같은 provider-native 산문을 대신 들고 있어야 하는 구조를 만든다. 즉 sync가 "변환"이 아니라 "provider별 문서 저작"을 하고 있고, 책임 경계가 흐리다.

관련 코드: `packages/wrapper/src/sync/{context-transform,managed-block,sync-engine,manifest}.ts`. 관련 산출물: `AGENTS.md`(generated block), manifest v5(`.aco/sync-manifest.json`).

## Goals / Non-Goals

**Goals:**
- `aco sync`의 책임을 **구조적 표면 변환으로 한정**한다.
- `AGENTS.md`를 hand-maintained peer 문서로 전환한다 — sync는 이 파일을 **생성·감지·기록하지 않는다**.
- provider-native 진입점 가이드(`$aco`/`aco delegate`)의 소유권을 각 provider 표면으로 이전한다(이슈 #145 흡수).

**Non-Goals:**
- 역방향 sync(`AGENTS.md → CLAUDE.md`) 도입 — 명시적으로 범위 밖(SoT 이중화·루프 위험).
- agents/skills/hooks 구조 변환 제거 — 유지한다.
- `aco ask`/`aco delegate` 런타임 동작 변경 — 본 변경은 surface/문서 경계 작업이다.
- sync가 기존 `AGENTS.md`를 자동으로 편집/정리하는 마이그레이션 로직 — 만들지 않는다(아래 D2).

## Decisions

**D1. `AGENTS.md` context 투영을 sync에서 제거하고 hand-maintained로 전환.**
- 대안 A: 유지하되 "shared-only"로 축소 — 기각. 여전히 SoT가 provider별 산문을 저작하고, 어디까지가 shared인지 새 경계 분쟁을 만든다.
- 대안 B(채택): 투영 자체 제거. `AGENTS.md`는 `CLAUDE.md`처럼 손유지 문서. 경계가 "freeform 지침 = 손유지 / 기계 변환 가능한 구조 표면 = sync"로 명확.

**D2. sync는 `AGENTS.md`/`GEMINI.md`를 인식하지 않는다 (감지·마이그레이션 로직 없음).**
- 생성 경로를 코드에서 **삭제**하고, 이 파일들을 sync의 target set에서 완전히 제외한다. sync는 이들을 **읽지도·감지하지도·쓰지도 않는다**.
- 기존 repo의 죽은 관리 블록 마커는 sync가 손대지 않는다. 이 repo에서는 사람이 같은 PR에서 **1회 수동 제거**한다(평범한 편집). 다운스트림에 남아도 무해한 HTML 주석이다.
- 대안(기각): (a) sync가 마커를 감지해 떼어내는 "동결/2단계 마이그레이션" — sync가 `AGENTS.md`에 다시 쓰는 동작을 새로 만들어, dirty 파일 덮어쓰기 위험과 그를 막을 가드를 함께 끌어들이는 **자기참조적 복잡성**. sync가 아예 건드리지 않으면 위험도 가드도 0. (b) `<!-- INCLUDE CLAUDE.md -->` 정적 include 디렉티브 — include 처리기가 필요해 sync 결합을 재도입하고, GitHub/Codex는 `AGENTS.md`를 raw로 읽어 디렉티브를 처리하지 않음.

**D3. manifest는 줄어든 target set으로 재생성된다 (별도 prune 없음).**
- generated target 집합에서 `AGENTS.md`/`GEMINI.md`를 제외하면, 다음 sync 시 manifest가 새 target set 기준으로 재생성되어 옛 키가 자연히 빠진다. 구버전 manifest의 잔존 키는 무시(에러 아님). 전용 prune/마이그레이션 코드는 불필요.

**D4. check/strict/force/dry-run 범위 축소.**
- 위 명령들은 구조적 표면 타깃만 검사·생성. `AGENTS.md`는 target이 아니므로 검사·드리프트 대상에서 자연히 빠진다.

**D5. provider-native 가이드 소유권 이전(#145 흡수).**
- Codex `$aco`/`aco delegate` 진입점 문서: `AGENTS.md`(손유지) + `.codex/skills/aco/`(일급 스킬, 기존 `$gh-*` 패턴 미러). root `CLAUDE.md`의 `## Codex $aco Entrypoint` 절은 Claude 시점만 남긴다.
- 프로젝트 정책 "`.codex/skills/`는 런타임 요구 증명 시에만 손유지"의 예외임을 문서화: 이 스킬은 sync 생성 대상이 아니라 Codex-native 표면 자산으로 손유지한다.

## Risks / Trade-offs

- **공유 정책 드리프트** — `CLAUDE.md`와 `AGENTS.md`가 따로 놀 수 있음 → Mitigation: `AGENTS.md`를 "전체 미러"가 아니라 **Codex 시점 문서**로 재정의(중복 최소화). 공통 불변식은 짧게, 필요 시 docs 노트/경량 lint.
- **잔존 inert 마커** — 기존/다운스트림 repo의 `AGENTS.md`에 옛 마커가 남을 수 있음 → 무해(HTML 주석). sync가 자동으로 손대지 않으므로 위험 없음. 정리는 사용자 재량(1회 수동).

## Migration Plan

1. sync 코드: `AGENTS.md`/`GEMINI.md` 생성 경로 삭제 + target set 축소(이로써 `--check`/manifest가 자연히 이 파일들을 제외).
2. 이 repo: `AGENTS.md`의 죽은 관리 블록 마커를 손으로 1회 제거하고, Codex `$aco`/`aco delegate` 진입점을 손유지 섹션으로 편입.
3. `.codex/skills/aco/` 일급 스킬 추가(ask + delegate).
4. root `CLAUDE.md` `## Codex $aco Entrypoint` 절을 Claude 시점만 남기도록 정리.
5. `docs/reference/context-sync.md` 및 README/AGENTS 표면 설명을 새 경계로 갱신.
- 롤백: 코드 revert 시 sync가 다시 `AGENTS.md`를 생성하게 된다. 손으로 제거한 마커는 그대로 두면 되며(재투영이 다시 관리 블록을 삽입), 데이터 손실 경로는 없다.

## Open Questions

- `AGENTS.md`를 손유지로 옮길 때 sync가 채우던 공유 헤더(repo 구조 등)를 어느 수준까지 손유지 본문에 보존할지(완전 손유지 vs 최소 핵심).
- `.codex/skills/aco/`를 향후에도 순수 손유지로 둘지, 아니면 별도 경량 생성 경로가 필요할지(현재 결정: 손유지 + 정책 예외 문서화).
