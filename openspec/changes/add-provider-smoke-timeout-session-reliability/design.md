## Context

Issue #105 targets the public Node wrapper path, not the older Go runtime contract. The current Node wrapper already writes `~/.aco/sessions/<session-id>/task.json`, `output.log`, `brief.md`, and `error.log` in several paths, and it records provider PID through `InvokeOptions.onPid` when `spawnStream()` starts a child process.

The gap is that timeout and cancellation are not one coherent runtime contract across `aco run`, `aco ask`, `aco cancel`, session state, and validation docs. `cmdRun()` can mark a cancelled session as failed, `cmdCancel()` only sends `SIGTERM` to the recorded PID, `spawnStream()` does not own timeout/graceful-kill behavior, and live Codex/Gemini smoke is not separated from deterministic fake-provider tests.

Important constraints from repo history and memory:

- Work must stay in the #105 worktree and branch.
- OpenSpec artifacts, implementation, tests, docs, and validation ledger must stay aligned as one contract.
- Live provider smoke must remain opt-in and must not be treated as implicit approval.
- TDD is required for behavior changes: failing tests first, then minimal implementation, then green verification.
- Plans should name the skills/plugins/agents or review roles to use at each phase so later agentic workers can execute without guessing.

## Goals / Non-Goals

**Goals:**

- Define one timeout contract for `aco run` and `aco ask`.
- Preserve current success-path provider streaming and artifact layout.
- Make provider failure, timeout, and cancellation produce deterministic session status and `error.log`.
- Record child process PID and terminate the provider process group where the platform supports it.
- Keep `aco cancel --session <id>` idempotent and safe for already-final sessions.
- Add deterministic unit/integration tests using fake/mock providers.
- Document opt-in real Codex/Gemini smoke separately from CI-safe repo tests.

**Non-Goals:**

- No live provider execution during CI or normal repo tests.
- No provider auth redesign.
- No multi-provider aggregation or structured `findings.json` schema.
- No OS-level sandbox promise for `restricted`; it remains a provider instruction/profile boundary.
- No Go runtime behavior changes except documentation cross-reference if needed.

## Decisions

### Decision 1: Put timeout control in the provider execution layer

`invokeProviderForSession()` will accept resolved execution control, including timeout milliseconds and kill grace milliseconds. It will pass timeout/cancel metadata through `InvokeOptions` to provider implementations and `spawnStream()`.

Rationale:

- `aco run` and `aco ask` already share `invokeProviderForSession()`.
- Timeout status and `error.log` handling must be consistent across both call sites.
- Keeping timeout below provider-specific classes avoids duplicating timers in Codex/Gemini providers.

Alternative considered: implement timeout only in each CLI command. That would miss provider-level PID/process-group cleanup and would likely drift between `run` and `ask`.

### Decision 2: Use `--timeout <seconds>` plus `ACO_TIMEOUT_SECONDS`, with a 300 second default

Timeout precedence will be:

1. CLI `--timeout <seconds>`
2. `ACO_TIMEOUT_SECONDS`
3. Default `300`

Rationale:

- It matches the existing Go runtime contract closely enough for user expectations.
- Seconds are easier to document for operators and smoke runbooks.
- Tests can use fake provider binaries with a one-second timeout, while lower-level unit tests can exercise millisecond helpers.

Alternative considered: add `--timeout-ms`. That is more test-friendly but creates a second public unit and diverges from the documented Go runtime shape.

### Decision 3: Add typed provider execution errors

Add a small runtime error module, for example `packages/wrapper/src/runtime/provider-execution-error.ts`, with `ProviderTimeoutError` and `ProviderCancelledError` or a shared error type carrying a stable `code`.

Rationale:

- `cmdRun()` and `cmdAsk()` can decide whether to mark `failed` or preserve `cancelled` without brittle string matching.
- Tests can assert semantic error codes and user-visible messages.

Alternative considered: keep plain `Error` messages. That is smaller, but it makes status handling fragile and hard to test without string coupling.

### Decision 4: Terminate process groups for real child processes

`spawnStream()` will spawn provider CLIs with a POSIX process group where supported, record the child PID, and use a helper such as `terminateProviderProcess(pid, signal)` for timeout/cancel cleanup. On POSIX the helper will prefer `process.kill(-pid, signal)` and fall back to `process.kill(pid, signal)` when group kill fails. On Windows it will kill the child PID.

Rationale:

- Codex/Gemini CLIs can spawn worker subprocesses.
- PID-only `SIGTERM` is not enough for reliable cancellation.
- This mirrors the existing Go runtime process-group contract without porting Go code.

Alternative considered: leave Node wrapper cancellation as PID-only. That is backward-compatible but does not satisfy the #105 reliability goal.

### Decision 5: Preserve cancelled state as final

If a running CLI observes that `task.json` was changed to `cancelled`, it must not overwrite it with `done` or `failed`. `cmdAsk()` already checks this in some paths; `cmdRun()` needs equivalent logic.

Rationale:

- `aco cancel` is a second process racing with the original `aco run`/`aco ask`.
- The session store is the observable contract; the final status must reflect the operator action.

Alternative considered: treat cancellation as failure. That loses operator intent and makes `aco status` less useful.

### Decision 6: Keep live provider smoke opt-in and record evidence separately

Add a runbook/scripted command for real Codex/Gemini smoke, but keep default `npm test`, targeted package tests, and CI smoke on mock/fake providers. Add a validation ledger under this change to split deterministic repo tests from optional live smoke.

Rationale:

- The user's workflow distinguishes local tests, dry-run proof, live runtime proof, and pushed/merged state.
- Live providers can be slow, authenticated, rate-limited, or mutating; they need explicit consent.

Alternative considered: run a small real Gemini smoke as part of completion. That crosses the consent boundary and makes CI unreliable.

## Risks / Trade-offs

- Timeout race can leave a child process alive if the provider CLI ignores `SIGTERM` → use process-group kill on POSIX, schedule `SIGKILL` after grace, and test with a fake child process that does not exit immediately.
- Process-group spawn can behave differently on Windows → keep a platform fallback and avoid claiming full process-tree cleanup on unsupported platforms.
- `aco cancel` cannot update a run-level `ledger.json` after the original `aco ask` process exits early or is killed externally → preserve session truth in `task.json`/`error.log` and document run ledger behavior.
- One-second timeout integration tests can be slow in full suites → keep most timeout behavior in unit tests with fake clocks/helpers, and limit CLI integration tests to one or two focused cases.
- Adding a public `--timeout` flag changes CLI help and docs → keep it additive, backward-compatible, and default-preserving.

## Migration Plan

1. Add failing tests for timeout parsing, provider timeout failure, PID recording, cancellation state preservation, and process termination.
2. Implement minimal runtime execution-control helpers and wire them through `aco run`, `aco ask`, provider `InvokeOptions`, and `spawnStream()`.
3. Update docs and runbook with deterministic test commands and opt-in live smoke commands.
4. Add `validation-ledger.md` for this change, recording which checks are repo-local and which live smoke checks were skipped or executed.
5. Validate with `openspec validate add-provider-smoke-timeout-session-reliability --type change --strict`, targeted package tests, `npm run typecheck`, `npm test`, and `git diff --check`.

Rollback is straightforward because the change is additive: revert the branch commits. No data migration is required; existing session artifacts remain readable.

## Open Questions

- Should `--timeout 0` be rejected or interpreted as no timeout? This design rejects non-positive values and keeps "no timeout" unsupported for public commands.
- Should `aco cancel` write `error.log` immediately, or should the running process write it after observing cancellation? This design makes `aco cancel` write a concise cancellation entry so the artifact exists even if the runner exits abruptly.
- Should `aco ask` run-level `ledger.json` include a top-level timeout setting? This design records timeout per run and per session if implementation can do so without broad schema churn; otherwise it documents timeout in session metadata first.
