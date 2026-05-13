## ADDED Requirements

### Requirement: Provider execution timeout

The Node wrapper SHALL apply a documented provider execution timeout to `aco run` and provider-invoking `aco ask` sessions.

#### Scenario: Default timeout is applied

- **WHEN** a user runs `aco run <provider> <command>` or `aco ask --yes` without a timeout flag or timeout environment variable
- **THEN** the provider execution timeout SHALL be `300` seconds.

#### Scenario: Environment timeout is applied

- **WHEN** `ACO_TIMEOUT_SECONDS` is set to a positive numeric value and the user does not pass `--timeout`
- **THEN** the provider execution timeout SHALL use `ACO_TIMEOUT_SECONDS`.

#### Scenario: CLI timeout takes precedence

- **WHEN** the user passes `--timeout <seconds>` and `ACO_TIMEOUT_SECONDS` is also set
- **THEN** the provider execution timeout SHALL use the CLI `--timeout` value.

#### Scenario: Invalid timeout is rejected before provider execution

- **WHEN** the user passes a non-numeric, zero, or negative `--timeout` value
- **THEN** the command SHALL exit non-zero before creating a provider session
- **AND** the error message SHALL identify `--timeout` as invalid.

#### Scenario: Timeout fails the session deterministically

- **WHEN** a provider invocation exceeds the resolved timeout
- **THEN** the command SHALL terminate provider execution
- **AND** the session `task.json` status SHALL be `failed`
- **AND** `error.log` SHALL include a timeout message with the provider name and timeout duration
- **AND** the command SHALL exit non-zero.

### Requirement: Provider process metadata and cleanup

The Node wrapper SHALL record spawned provider process metadata and use it for best-effort cancellation and timeout cleanup.

#### Scenario: PID is recorded after provider spawn

- **WHEN** a provider implementation spawns a child process and exposes a PID
- **THEN** the session `task.json` SHALL include that PID before provider output completion.

#### Scenario: Timeout terminates provider process group when supported

- **WHEN** a timeout occurs for a spawned provider child on a POSIX platform
- **THEN** the wrapper SHALL send a termination signal to the provider process group
- **AND** SHALL send a force-kill signal after the configured grace period if the child has not exited.

#### Scenario: Timeout cleanup falls back to PID kill

- **WHEN** process-group termination is unsupported or fails
- **THEN** the wrapper SHALL attempt to terminate the recorded provider PID directly
- **AND** SHALL still record the timeout failure in session artifacts.

### Requirement: Session cancellation is final and observable

The Node wrapper SHALL treat `aco cancel --session <id>` as an idempotent operator action that produces an observable final session state.

#### Scenario: Running session is cancelled

- **WHEN** a user runs `aco cancel --session <id>` for a running session with a recorded PID
- **THEN** the wrapper SHALL best-effort terminate provider execution
- **AND** the session `task.json` status SHALL become `cancelled`
- **AND** `error.log` SHALL include a cancellation message
- **AND** `aco cancel` SHALL exit successfully.

#### Scenario: Runner preserves cancelled status

- **WHEN** the original `aco run` or `aco ask --yes` process observes that its session was marked `cancelled`
- **THEN** it SHALL NOT overwrite the session status with `done` or `failed`
- **AND** it SHALL exit non-zero after recording any available cancellation details.

#### Scenario: Final sessions are not cancelled again

- **WHEN** a user runs `aco cancel --session <id>` for a session already marked `done`, `failed`, or `cancelled`
- **THEN** the wrapper SHALL leave the session status unchanged
- **AND** SHALL print an idempotent message rather than raising a provider execution error.

### Requirement: Provider failures preserve artifacts

The Node wrapper SHALL preserve inspectable artifacts for provider failure, timeout, and cancellation paths.

#### Scenario: Provider failure preserves partial output

- **WHEN** a provider emits output and then exits with an error
- **THEN** `output.log` SHALL retain the emitted provider output
- **AND** `error.log` SHALL contain the provider failure message
- **AND** session status SHALL be `failed`.

#### Scenario: Ask run ledger separates failed sessions

- **WHEN** `aco ask --yes` has a provider session that fails, times out, or is cancelled
- **THEN** the run-level `ledger.json` SHALL include that provider session with status `failed` or `cancelled`
- **AND** the run command SHALL exit non-zero.

#### Scenario: Status reports timeout and cancellation metadata

- **WHEN** a user runs `aco status --session <id>` after timeout or cancellation
- **THEN** the command SHALL report the final status, provider, command, started time, ended time, permission profile, and PID when present.

### Requirement: Deterministic tests and opt-in live smoke

The change SHALL distinguish deterministic repo validation from live provider smoke.

#### Scenario: Default tests avoid live providers

- **WHEN** `npm test` or the targeted package test command runs in CI
- **THEN** it SHALL use mock or fake providers only
- **AND** it SHALL NOT invoke real Codex or Gemini provider CLIs for remote model execution.

#### Scenario: Live smoke is explicitly opted in

- **WHEN** an operator wants to run real Codex or Gemini smoke
- **THEN** the docs or runbook SHALL provide an explicit opt-in command
- **AND** the command SHALL state that it can require provider auth and real runtime latency.

#### Scenario: Validation ledger separates evidence classes

- **WHEN** the change is prepared for PR
- **THEN** its validation ledger SHALL separate repo-local tests, dry-run proof, and optional live runtime smoke results.
