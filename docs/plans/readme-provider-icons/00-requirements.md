# README provider 아이콘 적용 + Gemini 잔존 정정 — 요구사항

> 상태: **요구사항 문서화만 완료(구현 전)**. 브랜치 `docs/readme-provider-icons`,
> worktree `.claude/worktrees/readme-icons`, 기준 `origin/main`(머지 후, `11dc797` 포함).
> 작성 맥락: antigravity 마이그레이션 PR #142 머지 직후 follow-up.

## 1. 목표

머지된 Antigravity 마이그레이션 이후 README/다이어그램에 남은 **Gemini 잔존을 정정**하고,
사용자가 `docs/images/`에 추가한 **provider 아이콘을 실제로 사용**하도록 README와 다이어그램
SVG를 갱신한다.

스코프 결정(사용자 확정): **"둘 다"** — ① README의 shields.io provider 뱃지를 로컬 아이콘으로
교체 + ② 다이어그램 SVG의 provider 노드에 아이콘 임베드. Gemini 잔존 정정은 양쪽 모두 포함.

## 2. 자산: provider 아이콘

`docs/images/`에 커밋 대상으로 추가됨(원래 main 체크아웃에 uncommitted였던 것을 이 브랜치로 가져옴):

| provider | 파일 | 크기/포맷 |
| --- | --- | --- |
| Claude (Code) | `docs/images/claudecode-icon.png` | 640×640 PNG (colormap) |
| Antigravity | `docs/images/antigravity-icon.png` | 540×540 PNG (RGBA) |
| Codex | `docs/images/codex-icon.webp` | 500×500 WebP |

## 3. 요구사항

### R1 — Gemini 잔존 정정 (텍스트)

- `README.md:362` — `| \`aco ask\` | 외부 AI provider(Gemini, Codex)에 advisory ...` 의
  `Gemini` → `Antigravity` (순서는 `Antigravity, Codex` 등으로 정리).
- 본문 전반 재확인(직전 스캔상 README의 Gemini 잔존은 362 한 곳뿐).

### R2 — 다이어그램 SVG의 Gemini 정정 + 제거된 타깃 반영

README가 임베드하는 SVG 중 2개가 stale:

- `docs/images/architecture-overview.svg` — `gemini`/`Gemini`/`GEMINI` 텍스트 **6곳**.
  provider 노드: Claude / Codex / **Gemini**. Gemini 노드를 **Antigravity**로 교체.
- `docs/images/context-sync.svg` — `gemini` 텍스트 **4곳**. 특히
  `>Gemini CLI<`, `>GEMINI.md  ·  .gemini/agents/<`, `>.gemini/settings.json<` 는
  **마이그레이션으로 제거된 sync 타깃**이다. 단순 텍스트 치환이 아니라 실제 구조
  (`AGENTS.md`로 수렴, `GEMINI.md`/`.gemini/*` target 드롭)를 반영해야 한다.
  → context-sync는 sync surface 자체가 바뀐 것이므로 노드/엣지 의미까지 검토.
- `docs/images/session-lifecycle.svg` — provider 참조 없음. **수정 불필요.**

### R3 — README provider 뱃지 → 로컬 아이콘

shields.io provider 뱃지를 `docs/images/*-icon.*` 로컬 아이콘으로 교체. 대상(현 origin/main 기준 라인, 구현 시 재확인):

- 상단 tech-stack 뱃지: `README.md:32`(Claude) / `:33`(Antigravity) / `:34`(Codex, `OpenAI_Codex`)
- Prerequisites 표(flat-square): `:152`(Claude_Code) / `:158`(Antigravity_CLI) / `:164`(Codex_CLI)
- Provider setup 표(for-the-badge): `:249`(Antigravity) / `:254`(Codex)

표현 방식(구현 시 결정): 아이콘은 정사각형이라 기존 가로형 뱃지와 레이아웃이 다르다.
권장 — 작은 정사각 아이콘(`height` 20~28px) + 텍스트 라벨 병기, 또는 아이콘 위 라벨.
`<img src="docs/images/antigravity-icon.png" alt="Antigravity" height="24" />` 형태는
GitHub markdown에서 정상 렌더된다(상대경로 img 허용).

### R4 — 다이어그램 SVG에 아이콘 임베드

architecture-overview.svg / context-sync.svg의 provider 노드에 실제 아이콘을 넣는다.

- **GitHub 렌더링 제약(중요)**: README가 SVG를 `<img src="docs/images/x.svg">`로 임베드하는데,
  GitHub의 SVG-as-`<img>`는 **샌드박스**라 SVG 내부의 외부/상대 `<image href="...png">`는
  **로드되지 않는다**. 따라서 아이콘은 **base64 data URI로 SVG에 인라인** 해야 렌더된다
  (`<image href="data:image/png;base64,..." x=.. y=.. width=.. height=.. />`).
- 용량: antigravity-icon.png(70KB)을 base64로 넣으면 SVG가 약 +90KB 커진다. 두 SVG에 여러 종
  아이콘 → 합산 증가량 고려. 필요 시 아이콘을 적정 px로 리사이즈해 용량 축소.
- **WebP 주의**: `codex-icon.webp`를 SVG `<image>` base64로 임베드 시 일부 렌더러 호환 이슈 가능.
  안전하게 **PNG로 변환 후 임베드** 권장(R3 뱃지는 webp 그대로 두고, SVG 임베드용 png 사본 별도).
- provider 노드의 좌표/크기를 SVG에서 찾아 아이콘 `<image>`를 라벨 옆/위에 배치. 기존 텍스트
  라벨은 유지하거나 아이콘+축약 라벨로 조정.

## 4. 손댈 파일

- `README.md` (R1, R3)
- `docs/images/architecture-overview.svg` (R2, R4)
- `docs/images/context-sync.svg` (R2, R4)
- `docs/images/{claudecode-icon.png, antigravity-icon.png, codex-icon.webp}` (자산 커밋)
- (선택) SVG 임베드용 png 변환 사본

## 5. 검증

- GitHub 실제 렌더 확인(SVG 내 아이콘이 보이는지 — base64 인라인 필수). PR preview로 확인.
- 잔존 스캔: `grep -riE "gemini" README.md docs/images/*.svg | grep -vi antigravity` → 0건
  (마이그레이션 설명용 정당한 언급 제외).
- 로컬 CI 게이트: `npm run verify:fast`(이 repo는 push 전 pre-push 훅이 자동 실행). prettier
  format:check는 `packages/*/src/**/*.ts`만 대상이라 README/SVG는 lint 비대상 → 통과에 영향 없음.

## 6. 제약/메모

- `origin/main`은 머지 완료 → 이 작업은 **새 브랜치 `docs/readme-provider-icons` + PR**로 진행.
- 아이콘 파일은 원래 main 체크아웃에 **uncommitted**였다. 이 브랜치에 커밋해 보존.
- 커밋 메시지는 repo 정책(conventional title + 한국어 body + AI trailer) 준수.

## 7. 부록 — Codex orchestrator 상태 (사용자 질의 답변, 별개 항목)

질문: "Codex CLI가 오케스트레이터로서 아직 로드맵 상태인가?" → **아니다. 현재 동작한다. 단 얇다.**

- `aco ask` CLI는 provider-중립 — 어느 세션(Claude/Codex/쉘)에서든 `aco ask --providers
  antigravity|mock --task ... --yes`로 위임 가능.
- **Claude**: 일급 통합 — `/aco` 커맨드(`.claude/commands/aco.md`) + `aco-delegation` 스킬.
- **Codex**: `AGENTS.md`의 `## Codex \`$aco\` Entrypoint` 절에 진입점이 **문서화**됨
  (peers = `antigravity`/`mock`). `aco ask`를 그대로 호출하면 동작 → **로드맵 아님**.
  단 openspec/`$gh-*`처럼 **패키지된 `$aco` 스킬 파일은 없음**(컨벤션/문서 레벨).
- 설계상 **Claude는 위임 peer가 아님**(Claude provider 미생성).
- **선택적 후속 개선**(이 README 작업과 별개): `.codex/skills/aco/`에 타입드 `$aco` 스킬을 추가해
  Codex에서도 `$gh-*`처럼 일급 커맨드 UX 제공. 필요 시 별도 이슈로 분리.
