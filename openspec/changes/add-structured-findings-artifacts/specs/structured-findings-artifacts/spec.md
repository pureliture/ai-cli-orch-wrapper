## ADDED Requirements

### Requirement: Structured findings artifact

`aco ask` SHALL persist machine-readable structured findings for provider sessions while preserving raw provider output and human-readable briefs.

#### Scenario: Successful provider session writes findings artifact

- **WHEN** `aco ask` invokes a provider successfully
- **THEN** the session artifact directory SHALL include a structured findings artifact
- **AND** the artifact SHALL include schema version, session id, provider, command, generated timestamp, parse status, and findings list.

#### Scenario: Findings remain advisory

- **WHEN** a structured finding is recorded
- **THEN** the finding SHALL be represented as an advisory provider claim
- **AND** it SHALL include enough validation guidance for a maintainer or supervising agent to verify it before acting.

#### Scenario: Raw output remains available

- **WHEN** structured findings are created
- **THEN** the full provider output SHALL still be stored in `output.log`
- **AND** existing `aco result` behavior SHALL remain backward compatible unless an explicit new option is used.

#### Scenario: Malformed structured output is handled conservatively

- **WHEN** structured extraction fails or provider output is malformed
- **THEN** provider invocation status SHALL remain based on the provider process result
- **AND** the findings artifact SHALL record a non-ok parse status or equivalent error metadata.

#### Scenario: Output modes preserve token-saving behavior

- **WHEN** `aco ask` runs in `brief` or `save-only` mode
- **THEN** structured findings SHALL NOT cause unbounded provider output to be printed to stdout.
