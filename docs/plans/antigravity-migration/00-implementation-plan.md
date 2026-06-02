# Antigravity 마이그레이션 구현 plan

> Gemini CLI(6.17 EOL) 제거 → Antigravity CLI(`agy`) 교체, Codex를 orchestrator 지원대상에 추가,
> context-sync를 `AGENTS.md` 단일 수렴으로 재설계.
> 작성 2026-05-31. 출처: `~/Projects/routine-harness/knowledge/antigravity-2.0/`(1순위) +
> routine-harness 어댑터 커밋(`82f0d65`, `5e7a7be`, `eb2f15e`, `0696b83`, `7694cae`) + repo 실측 + `agy 1.0.3` CLI 프로브.

---

## 0. 확정 결정

| # | 결정 |
|---|------|
| D1 | provider `gemini` → `antigravity` 리네임. binary `agy`. Go·Node 양쪽 모두. |
| D2 | Codex를 orchestrator로 추가(`$aco` 표면). orchestrator의 peer = `antigravity` + `mock`만. **Claude provider 생성 안 함.** |
| D3 | context-sync는 `AGENTS.md`로 수렴. `GEMINI.md` target/transform 제거. (root `GEMINI.md`는 commit `f448661`로 이미 삭제됨, sync 코드·manifest만 drift) |

---

## 1. 핵심 사실 (구현 전 필독)

### 1.1 이 repo는 Go + Node 이중 런타임
`docs/contract/go-node-boundary.md` 계약. **gemini provider가 양쪽에 존재 → 둘 다 마이그레이션 필요.**

- **Go 바이너리** (`cmd/aco/`): provider 자식 프로세스 실행, frontmatter/formatter 라우팅, CLI flag 검증, 파일경로 보안, **env allowlist**. `cmd/aco/main.go`가 `provider.NewGemini()`(key `gemini`) + `provider.NewGeminiCLI()`(key `gemini_cli`) 등록.
- **Node 래퍼** (`packages/wrapper/`): `IProvider` 런타임, `checkAuth` 휴리스틱, session store, slash dispatch, **sync engine**.
- `IProvider` 시그니처는 Go↔Node parity 유지 의무. `scripts/verify-contract.ts`가 CI에서 검증 → **antigravity provider는 양쪽에 동시 추가**해야 contract가 깨지지 않는다.

### 1.2 `agy 1.0.3` CLI 실측 (knowledge + 바이너리 프로브)
- 비대화형: **`agy -p "<prompt>"`** (`--print`/`--prompt` alias). prompt는 `-p`의 **flag 값**으로 전달됨(positional 아님, 프로브 `agy --print=notbool`로 확인) → **flag 순서 유연**, 기존 `gemini.ts`의 `['-p', combined]` 패턴 그대로. `--print-timeout` 기본 5m.
- 권한 자동승인: **`--dangerously-skip-permissions`** (gemini `--yolo` 등가, `agy --help` 확인). restricted 프로파일이면 생략.
- **`--cwd` 없음 (실측 확정)** → `agy --cwd /tmp`가 `flags provided but not defined: -cwd`로 거부됨(agy 1.0.3). workspace는 자식 프로세스 cwd(Node `spawnStream` cwd / Go `exec.Command.Dir`)로 지정, 추가 디렉터리는 `--add-dir`(repeatable). 문서 `cli/best-practices.md:97`의 `--cwd $(pwd)` 예시는 **1.0.3 바이너리에 부재 = doc drift**(리뷰 F01 기각 근거).
- **`-m`/`--model` 플래그 없음** → per-call 모델 전달 불가. 모델은 `/model`(persists across sessions) + settings "Model Usage"로 영속 설정되고 `agy -p`가 그 기본값 사용. ⇒ `options.model`/`-m`는 antigravity에서 **no-op**(또는 향후 pre-run model_config write로 매핑).
- 버전 프로브: **`agy --version` → `1.0.3`, exit 0** (유효). `-v`는 version 아님(인자 필요).
- 설치: **`curl -fsSL https://antigravity.google/cli/install.sh | bash`** → `~/.local/bin/agy` (npm 아님).
- auth: **OS Keyring**(Apple Keychain). 평문 creds 파일·문서화된 API key env **없음**. ⇒ `checkAuth`/`CheckAuth`는 binary 존재 + `--version` 프로브만. headless/CI 인증은 **미해결 리스크**.
- 모델 목록은 서버 구동(Gemini Enterprise Agent Platform): Gemini 3.5 Flash, Gemini 3.1 Pro(high/low), Gemini 3 Flash, Claude Sonnet 4.6(thinking), Claude Opus 4.6(thinking), GPT-OSS-120b. reasoning은 `/fast`·`/planning`·effort 레벨로 제어.

### 1.3 routine-harness 어댑터 계약 (agy 1.0.3 probed, 권위)
- **Skill**: workspace `.agents/skills/<name>/SKILL.md` runtime_supported(확인). 이 repo는 이미 `.agents/skills/` 공유 → **경로 변경 없음**.
- **Subagent**: agy는 직접 등록 표면 없음. routine-harness는 `.agents/agents/*.md`를 loader skill이 `define_subagent`로 변환하는 bridge로 사용. gemini `.gemini/agents/*.md`의 직접 등가물 없음 → **antigravity agent-sync target 드롭**(bridge는 future work).
- **Hook (doc/CLI divergence, 정확히 기술)**: knowledge `customizations/hooks.md:7`은 hooks.json이 workspace `.agents/` **또는** 글로벌 `~/.gemini/config/`에서 로드된다고 명시(2.0 GUI 기준). 그러나 routine-harness commit `0696b83`의 loader-level 프로브(agy 1.0.3, 전용 `--log-file`)는 **agy CLI가 글로벌 `~/.gemini/config/hooks.json`만 로드하고 workspace `.agents/hooks.json`은 안 읽음**을 재현적으로 확인. → 문서와 실제 CLI 동작이 갈림. **이 repo의 hook sync 결정은 "loading 여부"가 아니라 "repo가 애초에 hook을 sync 안 함"(go-node-boundary/context-sync 계약)에 근거** → antigravity hook은 **out_of_scope**, `hook-gemini-transform.ts`는 dead code로 제거. (리뷰 F1/AGF-02/F02 반영: 사실은 divergence로 기술, 결론 근거 교체)
- **Context**: agy는 프로젝트레벨 `AGENTS.md`+`GEMINI.md` 둘 다, 유저레벨은 `~/.gemini/GEMINI.md`만. sync는 project-scoped → `AGENTS.md` 수렴 안전.

---

## 2. Phase 구조 & 의존 그래프

```
Phase 1 (Provider: Go+Node 동시)  ──┬─→ Phase 2 (Sync engine)  ──┐
                                    ├─→ Phase 3 (Templates + $aco)─┤
                                    │                              ├─→ Phase 4 (Tests) ─→ Phase 6 (Validate+manifest regen)
                                    └──────────────────────────────┤
                                       Phase 5 (Docs/diagrams/openspec/contract) ─→ Phase 6
```

- **Phase 1**: Go·Node provider를 한 PR에서 함께 교체(contract parity 유지). 독립적, 가장 먼저.
- **Phase 2/3**: Phase 1의 `antigravity` 키에 의존. 서로 독립 → 병렬 가능.
- **Phase 4**: Phase 1–3 소스에 의존(테스트가 import).
- **Phase 5**: Phase 1·2 동작 반영. 문서-only.
- **Phase 6**: 전 phase 머지 후 `aco sync`로 manifest 재생성.

---

## 3. Phase 1 — Provider layer 교체 (Go + Node 동시)

**Goal**: `gemini`/`gemini_cli` provider를 단일 `antigravity`로 교체. Go·Node 양쪽 + 런타임 참조 전부.

### Go (`cmd/aco/`, `internal/`)
1. **create** `internal/provider/antigravity.go` — `AntigravityProvider`, `Name()="antigravity"`, `Binary()="agy"`, `InstallHint()="curl -fsSL https://antigravity.google/cli/install.sh | bash"`. `BuildArgs`: `["-p", combined]` + restricted 아니면 `"--dangerously-skip-permissions"`. **모델 플래그 없음**(`opts.Model` 무시). `IsAuthFailure`: exit 126 또는 stderr `unauthenticated`/`please run`. `AuthHint`: `"Run: agy  (OS Keyring/login)"`. `CheckAuth`: `agy --version` 5s 타임아웃.
2. **delete** `internal/provider/gemini.go`, `internal/provider/gemini_cli.go`.
3. **modify** `cmd/aco/main.go` — line 49–50: `NewGemini()`+`NewGeminiCLI()` 제거, `provider.NewAntigravity()` 등록. (codex는 유지)
4. **modify** `internal/provider/registry.go` — line 9 주석 "Phase 4 registers GeminiProvider" → antigravity 반영.
5. **modify** `internal/runner/process.go` — `envAllowlist`(line 34~)에서 `GEMINI_API_KEY` 제거. antigravity headless env key는 없음 → 신규 추가 없음(open risk로 기록). `ANTHROPIC_API_KEY`/`GITHUB_TOKEN`은 유지.

### Node (`packages/wrapper/src/`)
6. **create** `providers/antigravity.ts` — `AntigravityProvider implements IProvider`. `key='antigravity'`. `installHint='curl -fsSL https://antigravity.google/cli/install.sh | bash'`. `isAvailable: which('agy')!=null`. `checkAuth`: **env(GEMINI_API_KEY/GOOGLE_API_KEY)·파일(oauth_creds.json) fast-path 전부 제거**, binary 존재 + `readVersion('agy')` 프로브만. `buildArgs`: `['-p', `${prompt}\n\n${content}`]` + restricted 아니면 `'--dangerously-skip-permissions'`. **`-m`/`--cwd` 미사용**. `invoke`: `spawnStream(which('agy'), args, {processName:'agy', stdin:'pipe', cwd: workspace}, options)`. `summarizeOutput`: 기존 default.
7. **delete** `providers/gemini.ts` (2·3·4·6과 원자적 머지).
8. **modify** `providers/registry.ts` — `GeminiProvider` import/등록 제거, `AntigravityProvider` 등록. 순서 `antigravity, codex, mock`.
9. **modify** `index.ts` — `GeminiProvider` export → `AntigravityProvider`. `CodexProvider` export 추가(D2 peer 가시성).
10. **modify** `commands/doctor.ts` — provider 루프 `['mock','codex','gemini']`→`['mock','codex','antigravity']`. `formatGeminiReadiness`→`formatAntigravityReadiness`(env 없음, creds 파일 없음, Keyring 안내). `key==='gemini'` 분기 → `'antigravity'`.
11. **modify** `runtime/context.ts` (~line 146) — `provider==='gemini'` 분기 → `'antigravity'`. `agentsDir`는 antigravity에서 미사용(빈 목록 안전), `hooksPath`/`configPath`는 agy가 workspace에서 안 읽으므로 제외.
12. **modify** `runtime/run-prompt-template.ts` — `DOCUMENTED_PROMPT_COMMANDS` `gemini:*` → `antigravity:*`.
13. **modify** `util/credential-guard.ts` — `~/.gemini/oauth_creds.json` 정규식 제거(agy는 Keyring).
14. **modify** `sync/model-defaults.ts` — `DEFAULT_GEMINI_MODEL` 제거. antigravity는 CLI 모델 전달 불가하므로 default 불필요. `DEFAULT_CODEX_MODEL`만 유지. (소비처는 Phase 2에서 함께 제거 — **동일 커밋**)
15. **modify** `cli.ts` (~line 493) — help 예시 `codex,gemini,mock` → `codex,antigravity,mock`.
16. **modify** `commands/pack-install.ts`(wrapper·installer 양쪽) — `.gemini/commands/opsx` 관측 블록 제거(stale).
17. **modify** `session/store.ts` — 주석 모델 예시 `gemini-2.5-pro` → 일반화.

**원자성 게이트**: 2–4·6–9·14는 **한 커밋**(import/symbol 깨짐 방지). Go interface와 Node `IProvider` parity → `scripts/verify-contract.ts` 통과해야 함.

**성공 기준**: `gemini.ts`·`gemini.go`·`gemini_cli.go` 부재. `providerRegistry.keys()===['antigravity','codex','mock']`. Go `aco run antigravity ...`가 `agy -p` spawn. `go build ./...`·`npm run typecheck` green.

**검증**: `go build ./... && go test ./internal/provider/... ./cmd/aco/...`, `npm run typecheck`, `npx tsx scripts/verify-contract.ts`.

---

## 4. Phase 2 — Sync engine 재설계 (GEMINI.md 제거 → AGENTS.md 수렴)

**Goal**: `GEMINI.md` target·transform 제거, antigravity agent-target 드롭, manifest v4→v5 마이그레이션. dep: Phase 1.

1. **modify** `sync/sync-engine.ts` — 산출 target에서 `GEMINI.md` 제거. `syncGeminiAgents` 호출 제거. `LEGACY_HOOK_TARGETS`에서 `.gemini/settings.json`은 **유지**(과거 생성물 정리용 backward cleanup) — 단 신규 생성 경로에서만 제외. `.gemini/agents/*.md` legacy 정리 target 추가(아래 manifest 정리와 연계).
2. **delete** `sync/agent-gemini-transform.ts`, `sync/hook-gemini-transform.ts`. (antigravity는 agent·hook sync 안 함)
3. **modify** `sync/index.ts` — 위 두 transform export 제거(barrel). 직접 import하던 외부/테스트는 Phase 4에서 정리.
4. **modify** `sync/formatter.ts` — provider union에서 `gemini` 제거. `gemini_cli` 라벨이 있으면 `antigravity`로.
5. **modify** `sync/duplicate-detector.ts` — `provider:'gemini'` 항목 제거, `.gemini/commands/` 스캔 라벨 정리.
6. **modify** `sync/manifest.ts` — manifest version `4`→`5`. 마이그레이션 함수 **export**(현재 미export → 테스트 접근 가능하게). v4→v5: `targetHashes`/`targets`에서 `GEMINI.md`·`.gemini/agents/*` 키 제거, `sourceHashes`는 보존. **aco-owned target만 자동 정리**, external/unknown은 보존.
7. **modify** `.aco/sync-manifest.json` — `aco sync --force` 재생성으로 `GEMINI.md`·`.gemini/*` 제거(Phase 6에서 실행). 수동 편집 대신 엔진이 재생성.
8. **modify** `docs/reference/context-sync.md` — surface 표에서 Gemini 열 제거/antigravity로, 생성 파일 목록에서 `GEMINI.md`·`.gemini/agents` 제거(Phase 5와 함께).

**원자성 게이트**: manifest.ts(v5) + sync-engine.ts(GEMINI.md 제거) + model-defaults 소비처(`agent-gemini-transform` 삭제)는 **단일 머지**. 중간 상태에서 `aco sync --check`가 영구 red 되지 않도록.

**성공 기준**: `aco sync`가 `GEMINI.md` 미생성. `aco sync --check`가 GEMINI.md drift로 실패하지 않음. `.gemini/agents/` 생성 안 함.

**검증**: `npm run test -- sync`, `node dist/cli.js sync --dry-run`, `node dist/cli.js sync --check`.

---

## 5. Phase 3 — Templates/prompts 리네임 + Codex `$aco` orchestrator

**Goal**: gemini-named 템플릿/프롬프트 → antigravity, Codex orchestrator 표면 추가. dep: Phase 1.

1. **rename** `templates/commands/gemini/` → `templates/commands/antigravity/` (adversarial.md, rescue.md, review.md, setup.md). 내부 binary/flag 텍스트 antigravity화.
2. **rename** `templates/prompts/gemini/` → `templates/prompts/antigravity/` (adversarial.md, rescue.md, review.md, reviewer.md).
3. **rename** `.claude/aco/prompts/gemini/` → `.claude/aco/prompts/antigravity/` (adversarial.md, rescue.md, reviewer.md, **review.md 누락 여부 확인**).
4. **modify** `internal/prompt/defaults.go` — 프롬프트 키 `gemini-review`/`gemini-adversarial`/`gemini-rescue` → `antigravity-*`.
5. **modify** `.aco/formatter.yaml` — `gemini_cli` provider 키 → `antigravity`. `gemini-2.5-pro`/`gemini-2.5-flash` 모델 목록은 antigravity 모델로 교체하되 **구체 id는 TODO 표기**(agy는 CLI 모델 전달 불가 → 이 목록의 실효성 재검토 필요, open). `roleHintRules.research.preferredProvider: gemini_cli` → `antigravity`.
6. **modify** `commands/pack-install.ts`(wrapper·installer) — 템플릿 경로 목록 `gemini`→`antigravity`.
7. **Codex `$aco` orchestrator**: `.codex/`에 `$aco` 진입점 추가(기존 `$gh-*` 패턴 미러). Claude `.claude/commands/aco.md` + `aco-delegation` skill을 Codex 표면으로 노출 → Codex가 `aco ask`로 antigravity/mock peer에 위임 가능. `aco sync`의 공유 skill 규칙 따름.
8. **modify** `.claude/skills/aco-delegation/SKILL.md` + `.agents/skills/improve-codebase-architecture/SKILL.md` 등 gemini 언급 → antigravity.

**성공 기준**: gemini-named 템플릿/프롬프트 디렉터리 부재. `cmp` 정합 체크 통과. Codex `$aco` 진입점 동작.

**검증**: `npm run test:fixtures`, 템플릿 parity `cmp` 체크, `node dist/cli.js pack status`.

---

## 6. Phase 4 — Tests (Go + Node)

**Goal**: gemini 단정 전부 교체 + antigravity·AGENTS.md-only·orchestrator 신규 테스트. dep: Phase 1–3.

### Go
1. **modify** `internal/provider/gemini_test.go` → `antigravity_test.go`: BuildArgs(`-p`+`--dangerously-skip-permissions`, 모델 무시), CheckAuth(`agy --version`), IsAuthFailure.
2. **modify** `cmd/aco/cmd_run_test.go`, `cmd/aco/cmd_delegate_test.go` — provider `gemini`/`gemini_cli` → `antigravity`, `gemini-2.5-pro` 모델 문자열 제거/교체.
3. **modify** `internal/provider/registry_test.go` — 등록 provider 기대값.
4. **modify** `internal/runner/process_test.go` — env allowlist에서 `GEMINI_API_KEY` 제거 반영.

### Node
5. **modify** `tests/providers.test.ts`, `provider-session-reliability.test.ts` — AntigravityProvider invoke/args/auth.
6. **modify** `tests/credential-guard.test.ts` — `.gemini/oauth_creds.json` 경로 제거 반영(**Phase 1 credential-guard.ts와 배치**).
7. **modify** `tests/sync.test.ts` — `toGeminiAgent`/`serializeGeminiAgent` import 제거, AGENTS.md-only 생성 가드 추가.
8. **modify** `tests/sync-manifest-portability.test.ts` — v5 manifest, GEMINI.md 부재.
9. **modify** `tests/doctor-cli.test.ts`, `session.test.ts`, `runtime-context.test.ts`, `runtime-dashboard.test.ts`, `sentinel.test.ts`, `pack-runtime-contract*.ts`, `smoke.ts` — gemini → antigravity.
10. **modify** `test/fixtures/07-provider-not-found`, `08-auth-failure` 등 — provider 키/auth 시나리오 antigravity화. `baseline-node.json` gemini 참조.

**성공 기준**: `go test ./...` + `npm test` green. gemini 단정 0건.

**검증**: `go test ./...`, `npm test`, `npm run test:smoke`.

---

## 7. Phase 5 — Docs / diagrams / openspec / contract

**Goal**: 사용자 가시 문서·다이어그램·계약을 antigravity/AGENTS.md 상태로. dep: Phase 1·2.

1. **modify** `docs/contract/go-node-boundary.md` — Gemini fast-path 표(line 76~85), env allowlist 표(line 44~53, 176~189)에서 `GEMINI_API_KEY`/`GOOGLE_API_KEY` 제거, antigravity(Keyring) 추가. `IProvider` 예시 주석 `GeminiProvider`→`AntigravityProvider`.
2. **modify** `docs/architecture.md`, `docs/reference/context-sync.md`, `docs/reference/ubiquitous-language.md`, `docs/README.md`, `docs/guides/{contributing,runbook,github-workflow}.md`, `docs/security.md`, `docs/case-study.md`, `docs/contract/process-execution-contract.md` — gemini → antigravity, GEMINI.md 제거 반영.
3. **modify** `docs/images/{architecture-overview,context-sync,repository-structure}.svg` — Gemini 노드/엣지/라벨을 Antigravity로, GEMINI.md target 노드 제거, Codex orchestrator 승격 반영.
4. **modify** `openspec/changes/aco-v2-hardening/specs/gemini-cli-provider/spec.md` — antigravity-cli-provider로 spec 갱신(또는 신규 change로 supersede; OpenSpec 워크플로 따름).
5. **modify** `CLAUDE.md`/`AGENTS.md`(root) — Gemini 관련 언급, commit trailer 예시에서 Gemini CLI 줄 처리(antigravity는 GitHub 식별자 없음 → `AI-CLI:`/`AI-Model:` 트레일러 정책 따름).
6. **archive/plans/phases 문서**(`docs/archive`, `docs/plans`, `docs/phases`, `docs/superpowers`)는 **역사 기록 = 수정 금지**. 살아있는 문서만 변경.

**검증**: `git diff --check`, 문서 링크 점검, SVG 렌더 확인.

---

## 8. Phase 6 — 최종 검증 + manifest 재생성

dep: Phase 1–5.

1. `npm run build` + `go build ./...` 전체 빌드.
2. `aco sync --force` — manifest v5 재생성, `GEMINI.md`/`.gemini/*` 정리.
3. `aco sync --check --strict` — drift·중복 0.
4. 전체 테스트: `go test ./...`, `npm test`, `npm run test:fixtures`, `npm run test:smoke`.
5. `git diff --check`, 잔여 `gemini` grep 0 확인(역사 문서 제외).

**최종 성공 기준**: 전 빌드·테스트 green, `rg -i gemini` 결과가 역사 문서/CHANGELOG 외 0건, `aco run antigravity`·`aco delegate`·Codex `$aco`가 `agy` 실행.

---

## 9. 원자성 게이트 (반드시 한 머지로)

> **리뷰 반영(F2/F5/F07/ordering-F2,F5)**: Phase 1과 Phase 2는 typecheck·sync-check로 **강결합**되어 독립 PR 불가. 아래 G2/G4가 Phase 경계를 넘으므로 **Phase 1+2를 단일 atomic PR로 머지**한다(§2 그래프의 "독립 병렬" 문구 무효화). Phase 3 이후만 별도 PR 가능.

- **G1** (Phase 1, contract): Go provider 교체 + Node provider 교체 + `docs/contract/go-node-boundary.md`(allowlist·fast-path 표) + `verify-contract.ts` → IProvider parity & 계약 문서 drift 방지. (리뷰 F04/F05: 계약 문서를 Phase 5에서 분리하지 말고 코드와 같은 PR에)
- **G2** (Phase 1+2 joint): `model-defaults.ts`(DEFAULT_GEMINI_MODEL 제거) + 소비처 `agent-gemini-transform.ts` 삭제는 **반드시 같은 커밋** → typecheck 깨짐 방지. Phase 1·2가 한 PR이므로 충족.
- **G3** (Phase 1+4): `credential-guard.ts` 경로 제거 + `credential-guard.test.ts` 동일 커밋 → 테스트 red 방지.
- **G4** (Phase 1+2 joint): `manifest.ts` v5(migrateManifest export + `version:'4'` 하드코딩 교체 + `inferKindFromPath`의 GEMINI.md 분기 제거) + `sync-engine.ts` GEMINI.md 생성 제거 + `.gemini/agents/*` aco-owned 정리 → `aco sync --check` 영구 red 방지(루트 GEMINI.md는 이미 삭제됨, Phase 1만 머지되면 sync-check가 drift로 red).

---

## 10. Risks

| 심각도 | 리스크 | 완화 |
|---|---|---|
| P1 | agy headless/CI 인증 경로 불명(Keyring 의존, env key 없음) | CI 실행 전 인증 전략 별도 확정. Go env allowlist에서 GEMINI 제거하되 antigravity 대체 미정 → open으로 추적. |
| P1 | `.aco/formatter.yaml` 모델 목록이 antigravity에서 무의미(CLI 모델 전달 불가) | 모델 목록 항목의 실효성 재검토. 당장은 TODO 표기, 별도 결정. |
| P1 | Go/Node IProvider parity 깨짐 | G1 원자 머지 + `verify-contract.ts` CI 게이트. |
| P2 | manifest v4→v5 마이그레이션이 external/unknown target 오삭제 | aco-owned만 자동 정리, `--force` 없이는 drift 미덮어쓰기. |
| P2 | `.gemini/agents/` bridge 미구현으로 antigravity subagent 위임 불가 | 의도된 범위 축소(future work). 문서에 명시. |

---

## 11. Rollback

각 Phase는 독립 PR/머지. 문제 시 해당 머지 revert. Phase 6 manifest 재생성 전까지 `aco sync`는 GEMINI.md를 더 이상 안 쓰지만 기존 `.gemini/*` 산출물은 backward cleanup target으로 남아 안전 제거. provider 교체(Phase 1) revert 시 Go·Node 동시 revert 필요(parity).

---

## 12. Open decisions (구현 중 확정 필요)

1. **agy headless 인증**: CI/비대화형에서 Keyring 불가 시 대안(서비스 계정? env? 미문서). → 인증 전략 결정.
2. **`.aco/formatter.yaml` 모델 목록**: agy가 CLI 모델 미지원 → 이 목록을 유지할지, 영속 `/model` 설정으로 대체할지.
3. **`.agents/agents/` subagent bridge**: 지금 드롭. 향후 loader skill로 antigravity subagent 위임 지원할지.
4. **provider 프롬프트 디렉터리**: `gemini`→`antigravity` 리네임 확정(본 plan 채택). 대안: provider-neutral 명명.
5. **`gemini`/`gemini_cli` 2개 키 → `antigravity` 1개 통합** 확정(본 plan). 만약 두 arg 스타일 보존이 필요하면 재검토.

---

## 13. ultracode fan-out을 agy 워커로 (기존 aco delegate 표면 활용)

> 목표: ultracode/평상시 리뷰·분석 fan-out의 **워커를 Claude subagent 대신 agy**가 수행하게.
> 핵심: 이건 신규 발명이 아니라 **aco에 원래 있던 "subagent 스폰 대체" 표면**을 antigravity로 잇는 것.

### 13.1 이미 존재하는 표면 (마이그레이션이 잇는 대상)
aco의 원설계가 곧 "native feeling subagent 대체"임 (`docs/archive/brainstorm/2026-04-06-session2-aco-architecture.md`의 *peer agent response* 개념):

- **Custom agent 페르소나**: `.claude/agents/{reviewer,researcher,executor}.md` — provider-중립(`roleHint`, `modelAlias`, `promptSeedFile`만). 내부에서 `aco run`/`aco ask`로 외부 CLI 호출 → orchestrator가 Bash result가 아닌 **peer agent response**를 받음.
- **Delegate 커맨드**: `/review`·`/research`·`/execute` (Codex: `$review` 등) = role별 위임 진입점.
- **`aco-delegation` skill** + **`aco ask`/`aco run`** = consent-gated 위임 엔진.
- provider 선택은 페르소나가 아니라 **호출 시점**: `aco ask --providers <p>` 또는 `.aco/formatter.yaml`의 `roleHintRules.<role>.preferredProvider`.

→ **마이그레이션 후 워커가 agy로 도는 데 필요한 코드 변경은 Phase 3에서 이미 함**: `formatter.yaml`의 `gemini_cli`→`antigravity`, 모델 목록 정리. 추가로 `aco ask`의 provider 기본값(`DEFAULT_PROVIDERS=['mock']`)은 그대로 두되, fan-out은 `--providers antigravity`를 명시.

### 13.2 ultracode Workflow fan-out 패턴 (워커 = agy)
Workflow 스테이지를 네이티브 `agent()`(Claude) 대신 **Bash로 `aco ask`** 호출하게 작성. 각 워커는 *얇은 Claude 런처 1개 + agy 분석 1회*.

```js
// 워커 N개 = agy 분석 N회 (Claude는 런처/종합만)
const TARGETS = [/* 리뷰 대상 diff/파일/주제 */];
const findings = await parallel(TARGETS.map((t) => () =>
  agent(
    `Bash로 다음을 실행하고 stdout(JSON brief)만 반환:\n` +
    `aco ask --providers antigravity --task "review: ${t.title}" ` +
    `--input-file "${t.path}" --yes --output-mode brief`,
    { label: `agy:review:${t.key}`, phase: 'Review', model: 'haiku' } // 런처는 haiku로 얇게
  )
));
// 종합은 메인/별도 agent가 findings 합쳐서 수행
```

- **워커 = agy**: 실제 리뷰/분석 추론은 agy(antigravity) 토큰으로. Claude 런처는 `haiku`로 최소화.
- **consent**: `--yes` 필수(비대화형). 기본 `restricted` 프로파일 = read-only.
- **context 재섭취 최소화**: `--output-mode brief`로 stdout 축소, 전체 출력은 `aco result --session <id>` 아티팩트로 분리. 런처가 full을 컨텍스트로 빨아들이지 않게.
- **메인 루프 직접 호출도 가능**: subagent 런처조차 생략하고 메인이 `aco ask --providers antigravity`를 직접 fan-out(순차/병렬 Bash)해도 됨. 런처 계층 완전 제거.

### 13.3 비용 모델 (의도된 분담)
- agy 토큰 = *떠넘기려는 분석 비용* (원하는 것, 불가피·정상).
- Claude 토큰 = 런처(`haiku`) + brief 결과 종합. 얇게 유지하면 오버헤드 작음.
- 줄일 점: ① 분석엔 Claude subagent를 따로 안 띄우고 곧장 aco, ② `brief`+artifact로 재섭취 차단.

### 13.4 한계 / 비범위
- Claude Workflow `agent()`/Agent 도구를 *네이티브로 agy 프로세스화*하는 것은 여전히 불가(하네스 미지원). 본 패턴은 **Bash→aco 위임**이지 네이티브 스폰 교체가 아님.
- agy 세션 지속(`--continue`/`--conversation`)을 fan-out에 엮으려면 별도 배선 필요(현재 1-shot).
- 이 절은 **사용 패턴 문서화** + Phase 3의 `formatter.yaml` 변경에 의존. 별도 신규 런타임 코드는 없음(원하면 `aco ask --providers` 기본을 role별로 antigravity로 끄는 preset만 추가 검토 — open).

---

## 14. 멀티에이전트 리뷰 반영 (2026-05-31, confirmed 22건)

§1.2·§1.3·§9에 이미 접은 것 외, 실행이 따라야 할 file-level 보정:

### Phase 1 (provider)
- **F8 `runtime/context.ts`**: 단순 문자열 치환 아님. `pickProviderExposed`에 `provider==='antigravity'` 분기 신설 — `agentsDir`는 미사용(빈 목록), `hooksPath`/`configPath`는 `null`(agy CLI는 workspace hook 미로드). 기존 `'gemini'` 분기 제거.
- **F9 `run-prompt-template.ts`**: `DOCUMENTED_PROMPT_COMMANDS`를 `antigravity:review`로 바꾸면 `.claude/aco/prompts/antigravity/review.md`가 **존재해야 함**. 현 `.claude/aco/prompts/gemini/`엔 `reviewer.md`·`adversarial.md`·`rescue.md`만 있고 `review.md` 없음 → 명령명↔파일명 매핑 확인 후 누락 파일 생성, `pack-runtime-contract.test.ts` 동반 수정.
- **F10 `providers/antigravity.{ts,go}`**: `options.model`/`opts.Model`은 antigravity에서 **무시**(agy `-m` 없음). JSDoc/주석으로 명시하고 `go-node-boundary.md`에 기록.

### Phase 2 (sync) — Phase 1과 단일 PR
- **F3 `.gemini/agents/*` 정리 누락**: `agent-gemini-transform.ts`·`agent-codex-transform.ts`엔 stale-target 제거 로직이 없음(`skill-transform.ts`엔 있음). v5 migration 또는 sync-engine에서 manifest의 aco-owned `.gemini/agents/*`(16개)+`GEMINI.md` 키를 removed 처리하고 실제 파일 삭제.
- **F4 `manifest.ts`**: `migrateManifest`는 private → export. `version:'4'` 하드코딩(line ~147)을 `'5'`로, v4→v5 분기 추가. `inferKindFromPath`의 `GEMINI.md`→`config` 분기(line ~162) 제거.
- **F5 `formatter.ts`**: `resolveModelForProvider`의 타입 union `'codex' | 'gemini_cli'`(line ~23)를 `'codex' | 'antigravity'`로.
- **F6 `duplicate-detector.ts`**: `.gemini/commands/` 스캔 + `provider:'gemini'` 하드코딩 블록(line ~44–89, 184) 제거/antigravity화.
- **F7 `hook-parse.ts`**: `toGeminiHooks`(line ~128–167)·`GEMINI_SUPPORTED_EVENTS`(line ~87)·관련 주석 제거(`hook-gemini-transform.ts` 삭제와 동반, barrel export 정리).

### Phase 3 (templates/formatter)
- **F06 `.aco/formatter.yaml`**: provider 키 리네임 외 `launchArgs: ['--sandbox']` 처리 명세 — agy `--sandbox`가 동일 sandbox 역할인지 knowledge `cli/features.md` Terminal Sandbox로 확인 후 유지/대체.

### Phase 5/contract (일부는 G1로 Phase 1에 당김)
- **F04/F05 `go-node-boundary.md`**: env allowlist 표에서 `GEMINI_API_KEY` 제거, fast-path 표에 antigravity 행 추가 = `antigravity | (없음 — OS Keyring, env key 없음) | agy --version`. 코드와 같은 PR(G1).
- **F10(policy) §1.3 context**: agy는 workspace `.agents/rules/`도 rule로 로드(knowledge `customizations/rules-workflows.md`). 이 repo의 rules sync는 현재 out_of_scope 유지(이유 기록).

### 기각(refuted 7) — 실측/근거로 plan이 옳음
- **F01 `--cwd`**: agy 1.0.3가 `-cwd` 거부 확인 → plan의 "`--cwd` 없음"이 맞음. doc 예시가 drift.
- 그 외 6건: 차원 리뷰의 중복/오탐(haiku adversarial이 real=false 판정).

### 신규 리스크 (프로브 중 관측, P1)
- **agy `-p` print mode가 tool을 자동 실행**: 프로브에서 `agy --print=...`가 `run_command`·`search_web`·`list_dir`를 바로 실행함. ⇒ 비대화형 위임 시 비-restricted면 명령 실행 가능. **restricted 프로파일(=`--dangerously-skip-permissions` 생략)이 print mode에서 tool 실행을 실제로 막는지/행/auto-deny인지 검증 필요.** §13 fan-out·`aco` 보안 모델(read-only 강제)이 agy에 어떻게 매핑되는지 Phase 1에서 확인. (보안 영향 → Open Decisions 추가)

---

## 부록 A — 변경 대상 파일 인덱스 (역사 문서 제외)

**Go**: `cmd/aco/main.go`, `internal/provider/{antigravity.go(new), gemini.go(del), gemini_cli.go(del), gemini_test.go→antigravity_test.go, registry.go, registry_test.go}`, `internal/runner/process.go`, `internal/runner/process_test.go`, `internal/prompt/defaults.go`, `cmd/aco/{cmd_run_test.go, cmd_delegate_test.go}`.

**Node**: `packages/wrapper/src/providers/{antigravity.ts(new), gemini.ts(del), registry.ts, mock.ts?}`, `index.ts`, `commands/doctor.ts`, `commands/pack-install.ts`, `runtime/{context.ts, run-prompt-template.ts}`, `util/credential-guard.ts`, `cli.ts`, `session/store.ts`, `sync/{sync-engine.ts, agent-gemini-transform.ts(del), hook-gemini-transform.ts(del), index.ts, formatter.ts, duplicate-detector.ts, manifest.ts, model-defaults.ts}`, `packages/installer/src/{cli.ts, commands/pack-install.ts}`, `packages/wrapper/tests/*`(다수), `test/fixtures/*`.

**Config/templates**: `.aco/formatter.yaml`, `.aco/sync-manifest.json`, `templates/commands/gemini/*`→antigravity, `templates/prompts/gemini/*`→antigravity, `.claude/aco/prompts/gemini/*`→antigravity, `.codex/`($aco 추가).

**Docs**: `docs/contract/go-node-boundary.md`, `docs/architecture.md`, `docs/reference/{context-sync.md, ubiquitous-language.md}`, `docs/README.md`, `docs/guides/*`, `docs/security.md`, `docs/case-study.md`, `docs/contract/process-execution-contract.md`, `docs/images/*.svg`, `openspec/changes/aco-v2-hardening/specs/gemini-cli-provider/spec.md`, root `CLAUDE.md`/`AGENTS.md`.
