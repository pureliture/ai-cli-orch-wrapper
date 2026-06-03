## 1. ACO.md 작성

- [x] 1.1 현재 브랜치 aco 서브커맨드/위임 플래그/provider registry 수집 (`aco ask --help`, `aco --help`, registry: `codex`/`antigravity`/`mock`)
- [x] 1.2 root `ACO.md` 작성: 목적, 주요 서브커맨드, consent-gated 위임 흐름(`aco ask --dry-run` → `--yes`), 지원 provider 전체(`codex`/`antigravity`/`mock`, 기본값 `mock`), 주의사항
- [x] 1.3 Codex self-delegation(재귀) caveat 추가: Codex 세션에서 `--providers codex` 호출 위험과 다른 peer 위임 권장
- [x] 1.4 ACO.md 내용을 1.1 수집 결과와 대조해 폐기/오타 명령·플래그·provider 제거 (spec: 가이드-실제 동작 일치)

## 2. README 참조 안내 추가

- [x] 2.1 README에 "ACO.md 참조 설정" 섹션 신설 (RTK.md user-level 패턴 설명 포함)
- [x] 2.2 Claude 안내: `~/.claude/CLAUDE.md`의 `@ACO.md`. 경로 안전 안내 — `~/.claude/ACO.md` 사본 또는 절대경로 `@/abs/path/ACO.md` 사용, ACO.md 미존재 프로젝트에서 깨질 수 있음 경고, project `CLAUDE.md` `@ACO.md`는 그 repo 내에서만 안전
- [x] 2.3 Codex 안내: project root `AGENTS.md` 명시 텍스트 참조 1순위 + 복사-붙여넣기용 표준 문구 예시 제공, `@`-import 비지원 명시, user `~/.codex/AGENTS.md` 전역은 미검증 선택 대안으로 표기
- [x] 2.4 Antigravity 안내: user-level `~/.gemini/GEMINI.md`(global rules) 1순위 고정. project root `GEMINI.md`는 권장 아님(repo가 sync 제거) — 기존 workspace 정책 있을 때만 caveat 대안. `.agents/rules/` 대안 명시
- [x] 2.5 ACO.md 배치/경로 권장안 안내(사본/절대경로), repo가 사용자 홈을 자동 수정하지 않음을 명시

## 3. 문서 정합 보강

- [x] 3.1 `docs/reference/context-sync.md`의 "agy AGENTS.md 미지원" 문구를 구체 보강: "Antigravity CLI는 로컬 `AGENTS.md`/`GEMINI.md`를 파싱하나 `aco sync` 자동 생성/동기화 대상에서만 제외(hand-maintained)"임을 명시. 새 sync 생성 target은 추가하지 않음

## 4. 검증

- [x] 4.1 정적 체크: `ACO.md` 필수 섹션(서브커맨드·위임 흐름·provider 전체·주의사항) 존재 + `README.md` 참조 안내가 3 provider 경로/메커니즘 포함 (grep 기반)
- [x] 4.2 정확성 대조: ACO.md provider 목록·서브커맨드를 registry/`aco ask --help`와 대조, agy 경로를 knowledge(`~/.gemini/GEMINI.md`)와 대조
- [x] 4.3 회귀 가드: `aco sync --check`(가능하면 `--strict`) 통과
- [x] 4.4 allowlist diff gate: `packages/wrapper/src/cli.ts`·`commands/`·`sync/`, `.claude/commands/`, `templates/commands/`, `.agents/skills/`, `.codex/agents/` 무변경을 `git diff`로 확인 (명령/sync source 미변경 적극 증명)
- [x] 4.5 적극적 제외 검증: `.aco/sync.yaml`/sync 대상에 `ACO.md`·`README.md` 미등록 정적 대조
- [x] 4.6 artifact gate: `openspec validate aco-md-readme-reference --type change --strict` 통과
- [ ] 4.7 (선택) 수동 spot check: 임시 `CLAUDE.md`+`@ACO.md` 로딩 1회 확인, 임시 `GEMINI.md` agy 파싱 1회 확인. `git diff --check`
