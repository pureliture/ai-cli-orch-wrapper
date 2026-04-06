## ADDED Requirements

### Requirement: Wrapper compatibility SHALL be defined by observable process behavior
The repository SHALL define `ccg-workflow` compatibility for its wrapper in terms of observable process lifecycle behavior rather than implementation language. The compatibility surface SHALL cover provider process spawn, argument dispatch, stdout/stderr handling, PID tracking, cancellation behavior, and terminal exit semantics.

#### Scenario: Compatibility claim is evaluated
- **WHEN** a contributor asks whether the local wrapper matches `ccg-workflow`
- **THEN** the repository evaluates the claim against a written behavior contract instead of treating Go implementation as the compatibility condition

### Requirement: Compatibility scope SHALL exclude irrelevant `codeagent-wrapper` surfaces
The repository SHALL explicitly exclude `codeagent-wrapper` behaviors that are not needed in the current environment. Excluded surfaces SHALL include Windows-only process handling, Windows console suppression, browser auto-open, SSE/web UI streaming, and cross-platform wrapper binary packaging.

#### Scenario: Contributor reads the compatibility contract
- **WHEN** the contributor inspects the compatibility documentation
- **THEN** the contract states which `ccg-workflow` surfaces are intentionally out of scope and does not imply parity for those excluded behaviors

### Requirement: Compatibility contract SHALL define the required runtime lifecycle
The compatibility contract SHALL require the wrapper to spawn the target provider process, preserve the launched process identity for later lifecycle operations, stream provider stdout without waiting for full completion, capture provider stderr for failure diagnosis, and expose deterministic cancellation and exit outcomes.

#### Scenario: Wrapper launches a provider task
- **WHEN** the wrapper starts a provider command
- **THEN** it launches a child process, records enough process identity to support cancellation, and begins forwarding stdout while the process is still running

#### Scenario: Provider exits unsuccessfully
- **WHEN** the provider process exits with a non-zero code or terminates by signal
- **THEN** the wrapper surfaces a failure outcome and preserves diagnostic stderr content

#### Scenario: Contributor cancels a running task
- **WHEN** cancellation is requested for a running session
- **THEN** the wrapper targets the launched provider process deterministically and records the session as cancelled

### Requirement: Repository SHALL document current compatibility gaps
The repository SHALL document which parts of the required runtime lifecycle are already implemented locally and which parts are still missing or underspecified relative to the compatibility contract.

#### Scenario: Contributor plans implementation work
- **WHEN** the contributor uses this change as a planning baseline
- **THEN** they can distinguish already-aligned behaviors from missing compatibility work without inferring from code alone
