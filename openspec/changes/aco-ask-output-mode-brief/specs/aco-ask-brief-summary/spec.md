## ADDED Requirements

### Requirement: Brief Output Preview
The system SHALL include a preview of the provider's output in the brief mode response (`renderRunBrief` and `renderSessionBrief`), bounded to the first 1000 characters.

#### Scenario: Output is shorter than or equal to the boundary
- **WHEN** the provider output length is 1000 characters or less
- **THEN** the system includes the entire output in the brief preview section without any truncation indicator

#### Scenario: Output is longer than the boundary
- **WHEN** the provider output length exceeds 1000 characters
- **THEN** the system includes exactly the first 1000 characters in the brief preview section
- **THEN** the system appends a truncation indicator (e.g., `\n... (truncated)`) after the preview