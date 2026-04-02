## ADDED Requirements

### Requirement: Wrapper accepts provider and command as positional arguments
The wrapper CLI SHALL accept invocations of the form `aco run <provider> <command> [options]` and dispatch to the named provider.

#### Scenario: Successful dispatch
- **WHEN** user runs `aco run gemini review --input "some code"`
- **THEN** wrapper resolves the `GeminiProvider`, constructs the invocation, and streams output to stdout

#### Scenario: Unknown provider
- **WHEN** user runs `aco run unknown-provider review`
- **THEN** wrapper exits with a non-zero code and prints `Unknown provider: unknown-provider`

### Requirement: Wrapper creates and manages a session per invocation
The wrapper SHALL create a session directory at `~/.aco/sessions/<id>/` for each invocation containing `task.json` and `output.log`.

#### Scenario: Session created on run
- **WHEN** `aco run` is executed
- **THEN** a new directory `~/.aco/sessions/<uuid>/` is created with a `task.json` recording provider, command, status (`running`), and start timestamp

#### Scenario: Session marked done on success
- **WHEN** the provider invocation exits with code 0
- **THEN** `task.json` is updated with status `done` and end timestamp

#### Scenario: Session marked failed on error
- **WHEN** the provider invocation exits with non-zero code
- **THEN** `task.json` is updated with status `failed`; stderr is written to `error.log`

### Requirement: Wrapper streams provider output to stdout and persists to output.log
The wrapper SHALL write each chunk of provider output simultaneously to stdout and to `~/.aco/sessions/<id>/output.log`.

#### Scenario: Real-time streaming
- **WHEN** provider emits incremental output
- **THEN** each chunk is written to stdout without buffering and appended to `output.log`

### Requirement: aco result returns last or named session output
The wrapper CLI SHALL provide `aco result [--session <id>]` that prints the contents of `output.log` for the given session (or the most recent session if omitted).

#### Scenario: Result of last session
- **WHEN** user runs `aco result` after a completed run
- **THEN** wrapper prints the full contents of the most recent session's `output.log`

#### Scenario: Result of named session
- **WHEN** user runs `aco result --session <id>`
- **THEN** wrapper prints `output.log` for that session

### Requirement: aco status reports session state
The wrapper CLI SHALL provide `aco status [--session <id>]` that prints the status and metadata from `task.json`.

#### Scenario: Status of last session
- **WHEN** user runs `aco status`
- **THEN** wrapper prints provider, command, status, and timestamps of the most recent session

### Requirement: aco cancel terminates a running session
The wrapper CLI SHALL provide `aco cancel [--session <id>]` that sends SIGTERM to the provider subprocess and marks the session as `cancelled`.

#### Scenario: Cancel running session
- **WHEN** user runs `aco cancel` while a session is running
- **THEN** provider subprocess receives SIGTERM; `task.json` status is set to `cancelled`

#### Scenario: Cancel already-finished session
- **WHEN** user runs `aco cancel` on a session with status `done` or `failed`
- **THEN** wrapper prints a warning that the session is already complete and does nothing

### Requirement: Wrapper enforces permission profiles
The wrapper SHALL support named permission profiles (`default`, `restricted`, `unrestricted`) that control whether the provider is allowed to write files or execute shell commands. The profile is configurable per-command in the template and overridable via `--permission-profile` flag.

#### Scenario: Restricted profile blocks file writes
- **WHEN** command is invoked with `--permission-profile restricted` and provider attempts to write a file
- **THEN** wrapper blocks the write and logs a permission denial to `error.log`
