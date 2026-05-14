## 1. Spec and Review Gates

- [x] 1.1 Review `proposal.md`, `design.md`, and `specs/provider-session-reliability/spec.md` against issue #105 acceptance criteria and update any missing timeout, cancellation, PID, artifact, live-smoke, or validation-ledger requirement before implementation.
- [x] 1.2 Record architecture/system-design, testing/TDD, and security/runtime review results in the change directory before writing production code.
- [x] 1.3 Confirm the public timeout contract: `--timeout <seconds>`, `ACO_TIMEOUT_SECONDS`, and default `300` seconds.
- [x] 1.4 Confirm live Codex/Gemini smoke remains opt-in and is not part of default CI or `npm test`.

## 2. Failing Tests First

- [x] 2.1 Add failing tests for timeout parsing and precedence in `aco run` and `aco ask`.
- [x] 2.2 Add a failing runtime test proving a slow fake provider times out, exits non-zero, marks the session `failed`, preserves partial `output.log`, and writes `error.log`.
- [x] 2.3 Add a failing runtime test proving provider PID is recorded in `task.json` after a spawned fake provider starts.
- [x] 2.4 Add a failing cancellation test proving `aco cancel --session <id>` marks a running session `cancelled`, writes `error.log`, and terminates the fake provider process.
- [x] 2.5 Add a failing race test proving the original `aco run` or `aco ask --yes` process does not overwrite a `cancelled` session with `done` or `failed`.
- [x] 2.6 Add failing tests for provider failure artifact preservation and `aco ask` run-level ledger status when a provider fails, times out, or is cancelled.
- [x] 2.7 Run the new targeted tests before implementation and record the expected RED failures in `validation-ledger.md`.

## 3. Runtime Contract Implementation

- [x] 3.1 Add shared timeout parsing/resolution helpers for CLI flag, environment variable, default, and validation error handling.
- [x] 3.2 Add provider execution error types for timeout and cancellation so command handlers do not rely on string matching.
- [x] 3.3 Extend `InvokeOptions`, `invokeProviderForSession()`, and `spawnStream()` with timeout/graceful-kill execution control.
- [x] 3.4 Update `spawnStream()` to record PID, use process-group termination on POSIX where supported, and fall back to direct PID termination.
- [x] 3.5 Update `cmdRun()` to pass timeout control, preserve cancelled status, write `error.log`, and exit with the documented status.
- [x] 3.6 Update `cmdAsk()` to pass timeout control, preserve cancelled status, write per-session artifacts, and reflect failed/cancelled sessions in `ledger.json`.
- [x] 3.7 Update `cmdCancel()` to write a cancellation `error.log`, best-effort terminate the provider process, and remain idempotent for final sessions.

## 4. Documentation and Validation Evidence

- [x] 4.1 Update `docs/reference/session-artifacts.md` with timeout, cancellation, PID, `error.log`, and run ledger behavior.
- [x] 4.2 Update `docs/security.md` with the timeout/cancel boundary and the fact that live provider smoke is explicit and credential-dependent.
- [x] 4.3 Update `docs/guides/runbook.md` with deterministic repo validation commands and opt-in real Codex/Gemini smoke commands.
- [x] 4.4 Add `openspec/changes/add-provider-smoke-timeout-session-reliability/validation-ledger.md` separating repo-local tests, dry-run proof, optional live runtime smoke, and skipped live-smoke rationale.

## 5. Review, Simplification, and Completion Verification

- [x] 5.1 Run targeted timeout/cancel/session tests and make them pass with minimal implementation.
- [x] 5.2 Run `npm run typecheck --workspace=packages/wrapper`.
- [x] 5.3 Run `npm test --workspace=packages/wrapper`.
- [x] 5.4 Run `npm run test:smoke --workspace=packages/wrapper` if the changed runtime paths affect existing smoke coverage.
- [x] 5.5 Run `openspec validate add-provider-smoke-timeout-session-reliability --type change --strict`.
- [x] 5.6 Run `git diff --check`.
- [x] 5.7 Perform TypeScript/runtime/security review and a code-simplifier pass, then update `validation-ledger.md` with final evidence before claiming implementation complete.
