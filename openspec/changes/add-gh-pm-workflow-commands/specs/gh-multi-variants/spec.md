## ADDED Requirements

### Requirement: :multi variants combine /octo:multi with each /gh-* command
The system SHALL provide `:multi` variant slash commands for each of the four `/gh-*` commands (`/gh-issue:multi`, `/gh-start:multi`, `/gh-pr:multi`, `/gh-followup:multi`) that invoke `/octo:multi` validation before executing the corresponding base command.

#### Scenario: File structure as subdirectory
- **WHEN** `:multi` variants are installed
- **THEN** each variant SHALL exist at `.claude/commands/gh-<cmd>/multi.md` (e.g., `.claude/commands/gh-issue/multi.md`)
- **THEN** Claude Code SHALL invoke it as `/gh-issue:multi`

#### Scenario: /octo:multi prerequisite check
- **WHEN** user invokes any `:multi` variant
- **THEN** the command file SHALL include a prerequisite check comment noting that `/octo:multi` must be available
- **THEN** if `/octo:multi` is unavailable, the command SHALL display an instructional message and halt

#### Scenario: /gh-issue:multi flow
- **WHEN** user invokes `/gh-issue:multi`
- **THEN** system SHALL first activate `/octo:multi` for the issue content validation
- **THEN** upon multi-provider consensus, proceed with `/gh-issue` execution

#### Scenario: /gh-pr:multi flow
- **WHEN** user invokes `/gh-pr:multi`
- **THEN** system SHALL first activate `/octo:multi` for PR readiness validation (title, scope, checklist completeness)
- **THEN** upon validation, proceed with `/gh-pr` execution
