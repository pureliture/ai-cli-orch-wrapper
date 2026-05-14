## Why

Real Codex and Gemini provider runs can hang, take minutes, or fail because of local auth/runtime state while the current Node wrapper contract leaves timeout, cancellation, session status, and error artifacts underspecified. This blocks reliable pilot use because `aco run` and `aco ask` can hold the supervising Codex/Claude session without a deterministic failure record.

## What Changes

- Add a provider execution reliability contract for Node wrapper `aco run` and `aco ask`.
- Define timeout precedence and observable behavior for slow provider invocations.
- Ensure timeout and provider failure paths end sessions deterministically and write `error.log`.
- Record child process PID metadata in `task.json` when a provider process is spawned.
- Harden `aco cancel --session <id>` so cancellation updates session state and best-effort terminates the provider child process.
- Add fake/mock provider tests for success, provider failure, timeout, cancellation, and PID recording.
- Document opt-in real Codex/Gemini smoke commands and keep live provider calls out of default CI.
- Keep validation evidence split between repo-local deterministic tests and live runtime smoke.

## Capabilities

### New Capabilities

- `provider-session-reliability`: Node wrapper provider execution timeout, cancellation, PID, session status, and validation evidence behavior for `aco run` and `aco ask`.

### Modified Capabilities

- None.

## Impact

- Affected code: `packages/wrapper/src/runtime/provider-session-runner.ts`, `packages/wrapper/src/commands/ask.ts`, `packages/wrapper/src/cli.ts`, `packages/wrapper/src/session/store.ts`, provider implementations, and focused tests under `packages/wrapper/tests/`.
- Affected docs: `docs/reference/session-artifacts.md`, `docs/security.md`, `docs/guides/runbook.md`, and the change validation ledger.
- Runtime impact: provider child processes gain explicit timeout/cancel handling while success-path streaming and artifact layout remain backward-compatible.
- Security impact: live provider smoke remains opt-in, and deterministic tests use mock/fake providers so CI does not require provider credentials or leak secrets.
