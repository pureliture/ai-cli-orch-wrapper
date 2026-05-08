# Consent-Gated Delegation MVP Goal Ledger

작성일: 2026-05-08
작업 브랜치: `codex/consent-gated-delegation-mvp`
작업트리: `/Users/ddalkak/Projects/ai-cli-orch-wrapper/.worktrees/consent-gated-delegation-mvp`

## Product Thesis

`ai-cli-orch-wrapper`는 Claude Code 세션 안에서 사용자의 명시적 동의를 받은 뒤 Codex/Gemini 같은 외부 AI CLI에 작업을 위임하고, 결과는 session/run artifact로 저장하며, Claude Code에는 bounded brief만 반환해 토큰 사용량을 줄이는 generic external AI delegation wrapper다.

## Current State

- Node wrapper CLI는 `aco run <provider> <command>`, `aco result`, `aco status`, `aco cancel`, `aco sync`, `aco pack`, `aco provider setup`을 제공한다.
- Provider abstraction은 `IProvider`와 `ProviderRegistry`로 분리되어 있고 현재 `gemini`, `codex`가 등록되어 있다.
- `aco run`은 provider output을 `~/.aco/sessions/<session-id>/output.log`에 저장하고, `task.json`으로 상태를 추적한다.
- `aco result`는 최신 session 또는 `--session <id>`의 `output.log`를 출력한다.
- `aco sync`는 Claude source surface를 Codex/Gemini target surface로 변환하지만, delegation UX 자체는 아직 `run` 중심이다.
- 공개 registry에 deterministic `mock` provider가 없어서 인증 없는 demo path가 부족하다.
- slash command surface에는 `/aco` 단일 command가 아직 없고, delegation 제안 skill도 없다.

## Gaps Against Consent-Gated External Delegation

- `aco ask` high-level orchestration command가 없다.
- 외부 provider 실행을 `--yes`로 명시 동의하도록 강제하는 command path가 없다.
- `--dry-run`으로 실행 계획만 보여주는 ask-level UX가 없다.
- 기본 출력이 full provider output을 그대로 Claude Code에 흘리지 않도록 제한하는 ask-level output model이 없다.
- run-level artifact(`~/.aco/runs/<run-id>/ledger.json`, `brief.md`)가 없다.
- session artifact에 `input.md`, `prompt.md`, `brief.md`가 없다.
- 자연어 task/preset 기반 delegation model이 문서와 CLI에 연결되어 있지 않다.

## Decisions

- `aco run`은 low-level primitive로 유지한다. 기본 permission profile도 기존 호환성을 위해 바꾸지 않는다.
- 새 MVP surface는 `aco ask`에만 추가한다.
- `aco ask`의 기본 permission profile은 `restricted`다.
- `aco ask`의 기본 output mode는 `brief`다.
- MVP에서 `aco ask`의 기본 provider는 `mock`이다. 인증 없는 demo와 `aco result`의 기존 latest-session UX를 안전하게 보존하기 위해 real external provider는 명시적으로 `--providers codex,gemini`처럼 요청할 때만 실행한다.
- `aco ask`는 `--yes` 또는 `--dry-run` 없이는 provider를 실행하지 않는다.
- `--dry-run`은 provider auth check, session 생성, provider invoke를 하지 않는다.
- `brief`와 `save-only`는 full provider output을 stdout에 출력하지 않는다. full output은 session `output.log`에 저장하고 `aco result`로 조회한다.
- `mock` provider는 실제 AI 품질을 흉내 내지 않고 deterministic no-auth demo와 tests를 위한 provider로만 둔다.
- task-specific slash command는 추가하지 않는다. Claude Code slash command는 `.claude/commands/aco.md` 하나만 추가한다.
- `--preset`은 `.claude/aco/tasks/<name>.md` 또는 `~/.claude/aco/tasks/<name>.md`를 읽는 MVP 파일 기반 contract로 둔다.
- `--preset` name은 path traversal을 막기 위해 `[A-Za-z0-9][A-Za-z0-9_-]*` 형태만 허용한다.
- `aco ask`는 암묵적으로 stdin을 읽지 않는다. hanging CLI child process를 피하기 위해 입력은 `--input` 또는 `--input-file`로 명시한다.

## Available Scripts

Root `package.json`:

| Script               | Command                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`              | `npm run build --workspace=packages/wrapper`                                                                                                                    |
| `test`               | `npm run test:scripts && npm test --workspace=packages/wrapper`                                                                                                 |
| `test:smoke`         | `npm run test:smoke --workspace=packages/wrapper --if-present`                                                                                                  |
| `test:fixtures`      | `go build -o aco ./cmd/aco && npx tsx test/fixtures/harness.ts --binary ./aco`                                                                                  |
| `test:fixtures:node` | `npm run build --workspace=packages/wrapper && chmod +x packages/wrapper/dist/cli.js && npx tsx test/fixtures/harness.ts --binary packages/wrapper/dist/cli.js` |
| `test:scripts`       | `bash test/scripts/project-id-validation.test.sh`                                                                                                               |
| `typecheck`          | `npm run typecheck --workspace=packages/wrapper`                                                                                                                |
| `format:check`       | `prettier --check "packages/*/src/**/*.ts"`                                                                                                                     |
| `release`            | `npm run build && changeset publish`                                                                                                                            |

`packages/wrapper/package.json`:

| Script         | Command                                                                                                                                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`        | `tsc`                                                                                                                                                                                                                                   |
| `prepack`      | copy root `templates` into package `templates`                                                                                                                                                                                          |
| `test`         | `node --require tsx/cjs --test tests/providers.test.ts tests/session.test.ts tests/runtime-context.test.ts tests/runtime-dashboard.test.ts tests/sentinel.test.ts tests/sync.test.ts tests/sync-conflict.test.ts tests/ask-cli.test.ts` |
| `test:smoke`   | `tsx tests/smoke.ts`                                                                                                                                                                                                                    |
| `typecheck`    | `tsc --noEmit`                                                                                                                                                                                                                          |
| `format:check` | `prettier --check "src/**/*.ts"`                                                                                                                                                                                                        |

## Baseline Validation

- `npm install`: pass.
- `npm test`: baseline failed before MVP code changes.
  - Passing portion: `test:scripts` passed and 156 wrapper tests passed.
  - Failure: `packages/wrapper/tests/providers.test.ts` `Auth cache > reuses provider auth result within TTL`.
  - Evidence: assertion expected `calls === 1`, actual `2`.
  - Working hypothesis: `providers/auth-cache.ts` computes the cache path at module import time from the original home directory, while tests mutate `HOME` later. In the sandbox this causes writes to the real home cache path to fail silently, so the second call misses the cache.
  - Decision: treat this as a baseline unblocker. The existing failing test is the RED test for a minimal fix.
  - Resolution: `providers/auth-cache.ts` now resolves the cache path at call time, so tests and runtime HOME changes are respected.

## Implementation Notes

- Added deterministic `mock` provider and registry export.
- Added `aco ask` in `packages/wrapper/src/commands/ask.ts`, imported from `cli.ts`.
- Added run artifacts under `~/.aco/runs/<run-id>/ledger.json` and `brief.md`.
- Added ask session artifacts: `input.md`, `prompt.md`, `output.log`, and `brief.md`.
- Added `.claude/skills/aco-delegation/SKILL.md`, one generic `.claude/commands/aco.md`, matching `templates/commands/aco.md`, and preset files under `.claude/aco/tasks/`.
- Updated `/docs` surfaces for the canonical thesis:
  - `docs/README.md` now describes `aco ask`, consent gate, default `restricted`/`brief`, run/session artifacts, and mock demo.
  - `docs/architecture.md` now describes `aco ask` as the high-level consent-gated delegation layer above low-level `aco run`.
  - All existing visual materials under `docs/images/*.svg` were reviewed and updated to mention the MVP where relevant.
- Review fixes applied:
  - cancellation preserves `cancelled` instead of being overwritten to `failed`
  - provider failures keep partial `output.log` available for `aco result --session`
  - full provider output is streamed to file instead of accumulated in memory
  - invalid empty provider lists and invalid preset names are rejected
  - restricted prompt says never modify files without exception language
  - default provider is `mock` for MVP no-auth and single-session ergonomics

## Validation Commands

- Targeted provider tests: `npm test --workspace=packages/wrapper -- tests/providers.test.ts`
- Targeted ask tests: `npm test --workspace=packages/wrapper -- tests/ask-cli.test.ts`
- Wrapper package tests: `npm test --workspace=packages/wrapper`
- Full tests: `npm test`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Smoke: `npm run test:smoke`
- Diff check: `git diff --check`
- Final demo dry-run: `node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --dry-run`
- Final demo brief: `node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief`
- Final demo result: `node packages/wrapper/dist/cli.js result`

## Phase Checklist

- [x] Phase 0: Repository discovery started.
- [x] Package scripts inspected and recorded.
- [x] Baseline test run recorded.
- [x] Phase 1: MVP spec written.
- [x] Phase 2: TDD implementation plan written.
- [x] Phase 3: Multi-perspective review written.
- [x] Phase 4: MVP implementation complete.
- [x] Phase 5: Validation complete.
- [x] Phase 6: Final review complete.

## Blockers

- No true blocker.
- Baseline `npm test` failure was fixed by resolving auth cache paths at call time.

## Tool / Skill Availability Notes

- Used local skills: architecture, system-design, testing-strategy, documentation, deploy-checklist, tech-debt, using-git-worktrees, writing-plans, test-driven-development, verification-before-completion, writing-skills, code-simplifier.
- Context7 was available and used for Node.js `node:test` execution model reference.
- Subagent-driven development is available, but the implementation tasks are tightly coupled in a small TypeScript CLI surface. I will use targeted review subagents at review checkpoints rather than parallel implementation workers unless a slice becomes independent.
