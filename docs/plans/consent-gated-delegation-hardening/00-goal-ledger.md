# Consent-Gated Delegation Hardening Goal Ledger

작성일: 2026-05-08
작업 branch: `codex/92-consent-delegation-hardening`
기준 branch: `codex/consent-gated-delegation-mvp`
기준 PR: [PR #92](https://github.com/pureliture/ai-cli-orch-wrapper/pull/92)

## Goal 2 Thesis

`ai-cli-orch-wrapper`는 Claude Code 안에서 사용자의 명시 동의를 받은 뒤 Codex, Gemini 같은 외부 AI CLI에 advisory 작업을 위임하는 generic wrapper다. Claude Code는 supervisor이자 최종 synthesizer로 남고, 외부 provider output은 session/run artifact에 보존되는 보조 자료로만 취급한다.

Goal 2는 PR #92 MVP를 open-source quality 기준으로 단단하게 만든다. 범위는 raw input 보존, bounded brief summary, non-network `aco doctor`, session/run artifact v1 문서화, security policy 문서화, no-auth mock demo, docs/visualization refresh, CI-equivalent validation이다.

## Baseline Verification

| 항목                     | 현재 확인 결과                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| GitHub repo              | `pureliture/ai-cli-orch-wrapper`                                                               |
| PR #92 상태              | `open`, `merged=false`, `mergeable=true`                                                       |
| PR #92 head              | `codex/consent-gated-delegation-mvp` at `f075e4e460d3f1b6398ff521ed3662f3dd2f9e6f`             |
| PR #92 base              | `main` at `e9bdc6f5ca38fcb80d9b18d7e6808cfe78c0d846`                                           |
| Goal 2 strategy          | PR #92가 아직 merge되지 않았으므로 PR #92 head에서 stacked branch 생성                         |
| Worktree                 | `/Users/ddalkak/Projects/ai-cli-orch-wrapper/.worktrees/codex-92-consent-delegation-hardening` |
| Node                     | `v25.8.1`                                                                                      |
| npm                      | `11.11.0`                                                                                      |
| `docs/case-study.md`     | 존재함. Goal 1 이전 planned wording이 남아 있어 refresh 필요                                   |
| Root package metadata    | `Gemini CLI` 중심 description/keywords가 남아 있어 refresh 필요                                |
| PR #92 format regression | `npm run format:check`가 `packages/wrapper/src/commands/ask.ts`에서 실패함                     |

## Available Scripts

Root `package.json` scripts:

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

Wrapper `packages/wrapper/package.json` scripts:

| Script         | Command                                                   |
| -------------- | --------------------------------------------------------- |
| `build`        | `tsc`                                                     |
| `prepack`      | copies root `templates/` into package `templates/`        |
| `test`         | `node --require tsx/cjs --test ... tests/ask-cli.test.ts` |
| `test:smoke`   | `tsx tests/smoke.ts`                                      |
| `typecheck`    | `tsc --noEmit`                                            |
| `format:check` | `prettier --check "src/**/*.ts"`                          |

## Non-Goals And Forbidden Work

- Do not add task-specific slash command sprawl such as `/aco:review`.
- Do not call real Codex/Gemini/Claude providers without explicit approval.
- Do not claim `.acoignore`, secret scanning, OS sandboxing, provider isolation, or remote auth verification unless implemented and tested.
- Do not publish packages or create releases.
- Do not merge PR #92 or Goal 2 work automatically.
- Do not commit unrelated local artifacts or `~/.aco` session output.

## Approval-Wait Policy

If a command requires explicit approval and the session enters approval waiting, work stops immediately. Do not loop, repeat the same approval request, or try alternate commands to bypass the gate. Record the exact argv, reason for approval, expected output, redaction plan, abort criteria, and rollback owner before pausing.

## Milestone Progress

| Milestone                          | Status  | Evidence                                                         |
| ---------------------------------- | ------- | ---------------------------------------------------------------- |
| 5% Scope and baseline verification | Done    | PR #92 state, scripts, worktree, and format failure verified     |
| 10% Hardening spec                 | Done    | `01-hardening-spec.md`                                           |
| 20% RED tests                      | Done    | raw input, bounded summary, doctor, mock demo tests              |
| 30% Baseline fixes                 | Done    | Prettier, #93, #94 focused tests                                 |
| 45% Doctor/artifacts               | Done    | `aco doctor` and artifact docs                                   |
| 60% Security/docs core             | Done    | `docs/security.md`, `.acoignore.example`, README/runbook updates |
| 70% Visualization refresh          | Done    | `docs/images/*.svg` reviewed and updated                         |
| 80% Focused/full verification      | Done    | build/test/typecheck/smoke/format/diff/XML                       |
| 90% Multi-perspective review       | Done    | architecture/testing/security review                             |
| 95% Finalization                   | Done    | ledgers finalized, overclaim scan                                |
| 100% Commit/final report           | Pending | focused commit and report                                        |

## Final Status Before Commit

- Implementation progress: 95% complete. Commit/report remains.
- Runtime verification progress: 100% complete. See `04-validation.md`.
- P0 findings: none.
- P1 findings: resolved in branch.
- Real provider calls: not performed.
- Approval-wait handling: one sandbox escalation was requested for `npm run test:smoke`; after approval, the command passed. No approval loop was attempted.
