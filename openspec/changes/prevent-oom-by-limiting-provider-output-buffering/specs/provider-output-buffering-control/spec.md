## ADDED Requirements

### Requirement: Provider output buffering policy
The system SHALL support configurable output buffering modes for provider invocation, with a safe default that avoids unbounded in-memory accumulation.

#### Scenario: Default behavior avoids unbounded buffering
- **WHEN** a caller invokes a provider without explicitly requesting bounded output buffering
- **THEN** the system SHALL use `stream-only` policy by default
- **AND** no unbounded full-output accumulation in memory SHALL occur for that invocation.

#### Scenario: Bounded buffering is used when requested
- **WHEN** a caller requests bounded buffering with `maxBufferBytes` set
- **THEN** the system SHALL retain at most `maxBufferBytes` of output in memory for that invocation.
- **AND** buffered output SHALL remain available to the caller as a bounded preview.

#### Scenario: Full buffering is explicitly opted in
- **WHEN** a caller explicitly requests full-buffer mode
- **THEN** the system SHALL allow full in-memory buffering for that invocation only
- **AND** the caller MUST provide explicit intent (for example via an explicit option) so the behavior is auditable.

#### Scenario: Invalid buffering configuration is rejected
- **WHEN** a caller configures bounded mode with `maxBufferBytes` less than 1
- **THEN** the system SHALL reject the configuration and return a clear error.
