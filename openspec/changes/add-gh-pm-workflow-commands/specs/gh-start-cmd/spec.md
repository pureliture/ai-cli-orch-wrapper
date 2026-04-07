## ADDED Requirements

### Requirement: /gh-start command transitions issue to In Progress and creates branch
The system SHALL provide a `/gh-start #N` Claude Code slash command that moves issue #N to "In Progress" on Project #3, adds `status:in-progress` label, and creates a local git branch derived from the issue title.

#### Scenario: Issue status transition
- **WHEN** user invokes `/gh-start #N`
- **THEN** system SHALL update Project #3 status field (`PVTSSF_lAHOA6302M4BT5fAzhBFN48`) for the issue item to "In Progress" (`68368c4f`) using `gh project item-edit`

#### Scenario: Label assignment
- **WHEN** user invokes `/gh-start #N`
- **THEN** system SHALL add `status:in-progress` label to issue #N via `gh issue edit --add-label`

#### Scenario: Branch creation with ASCII slug
- **WHEN** user invokes `/gh-start #N`
- **THEN** system SHALL fetch the issue title, derive a branch slug by converting non-ASCII characters via `iconv -t ASCII//TRANSLIT`, lowercasing, replacing non-alphanumeric with `-`, and truncating to 40 chars
- **THEN** system SHALL create a local branch named `<type>/<N>-<slug>` (e.g., `feat/25-add-gh-pm-workflow-commands`) via `git checkout -b`

#### Scenario: Non-ASCII title handling
- **WHEN** issue title contains Korean or other non-ASCII characters
- **THEN** system SHALL produce a valid ASCII-only branch name without errors
