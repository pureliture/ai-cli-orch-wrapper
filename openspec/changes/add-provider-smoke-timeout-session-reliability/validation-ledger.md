# Provider Smoke Timeout Session Reliability Validation Ledger

## Scope

- Issue: #105
- Change: `add-provider-smoke-timeout-session-reliability`
- Worktree: `/Users/ddalkak/Projects/ai-cli-orch-wrapper/.aco-worktrees/fix-provider-smoke-timeout-session`
- Branch: `fix/provider-smoke-timeout-session`

## Repo-Local Deterministic Evidence

| Command                                                                                                             | Result                 | Notes                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `openspec validate add-provider-smoke-timeout-session-reliability --type change --strict`                           | Passed                 | `Change 'add-provider-smoke-timeout-session-reliability' is valid`.                                                                                                      |
| `npx --yes prettier@3.0.0 --check <touched files>`                                                                  | Passed                 | Formatting initially flagged the new test and ledger; `prettier --write` was run, then check passed.                                                                     |
| `npm exec --workspace=packages/wrapper -- node --require tsx/cjs --test tests/provider-session-reliability.test.ts` | RED failed as expected | Before implementation: invalid `--timeout` was ignored, slow provider runs succeeded, ask ledger stayed successful, and cancellation did not finish the original runner. |
| `npm exec --workspace=packages/wrapper -- node --require tsx/cjs --test tests/provider-session-reliability.test.ts` | Passed                 | After implementation: 9 tests passed, 0 failed.                                                                                                                          |
| `npm run typecheck --workspace=packages/wrapper`                                                                    | Passed                 | `tsc --noEmit` exited 0.                                                                                                                                                 |
| `npm test --workspace=packages/wrapper`                                                                             | Passed                 | 226 tests passed, 0 failed.                                                                                                                                              |
| `npm run test:smoke --workspace=packages/wrapper`                                                                   | Passed                 | 10 smoke checks passed, 0 failed.                                                                                                                                        |
| `git diff --check`                                                                                                  | Passed                 | No whitespace errors after formatting.                                                                                                                                   |

## Dry-Run Evidence

| Command                                                                                                                                           | Result | Notes                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `npm exec --workspace=packages/wrapper -- node --require tsx/cjs src/cli.ts ask --providers mock --task "timeout dry run" --dry-run --timeout 12` | Passed | Printed `Timeout seconds: 12` and `Provider execution: skipped`. |

## Optional Live Runtime Smoke

| Command                                                                                                             | Result  | Notes                                                                       |
| ------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `node packages/wrapper/dist/cli.js run gemini review --input "hello" --permission-profile restricted --timeout 120` | Skipped | Live provider execution requires explicit approval and local provider auth. |
| `node packages/wrapper/dist/cli.js run codex review --input "hello" --permission-profile restricted --timeout 120`  | Skipped | Live provider execution requires explicit approval and local provider auth. |

## Review Notes

- Architecture/system-design review: reviewed before production code. The timeout/cancel control belongs in the shared Node wrapper provider execution path (`invokeProviderForSession()` -> provider `invoke()` -> `spawnStream()`), not separately in every provider command handler. The design keeps live provider smoke opt-in and preserves existing success-path artifact layout.
- Testing/TDD review: reviewed before production code. Implementation must begin with failing deterministic tests that use fake provider binaries and temp `HOME`; real Codex/Gemini provider execution remains outside default CI.
- Security/runtime review: reviewed before production code. Timeout and cancellation are reliability controls, not sandbox guarantees. Cancellation must be best-effort and artifact-visible, and live smoke must not run without explicit approval and local provider auth.
- Code-simplifier pass: completed after green targeted/full tests. Recent changes stayed split into timeout parsing, typed execution errors, process termination, shared runner wiring, command handlers, tests, and docs; no extra abstraction was added.

## Evidence Boundary

This ledger intentionally separates deterministic repo evidence from live runtime smoke. A green repo test run does not prove live provider latency/auth behavior. A live provider smoke result must not be claimed unless the command was explicitly approved, executed, and recorded here.
