## ADDED Requirements

### Requirement: /gh-pr adds PR to PM Project and sets In Review status
The system SHALL, after creating a PR, explicitly add the PR to the PM Project and set its Status to "In Review" via `gh project item-edit`, without relying solely on the PostToolUse hook.

#### Scenario: PR added to Project on creation
- **WHEN** user invokes `/gh-pr` and PR is successfully created
- **THEN** system SHALL run `gh project item-add 3 --owner pureliture --url <pr_url>` to add the PR to Project #3
- **AND** system SHALL run `gh project item-edit` to set the PR item Status to "In Review"

#### Scenario: Linked issue status set to In Review
- **WHEN** PR body contains a `Closes #N`, `Fixes #N`, or `Resolves #N` keyword
- **THEN** system SHALL find the Project item for issue #N and set its Status to "In Review"

#### Scenario: Idempotent operation
- **WHEN** PR or issue is already present in the Project
- **THEN** system SHALL update the Status without creating a duplicate item

#### Scenario: Project update failure does not block PR
- **WHEN** any `gh project item-add` or `gh project item-edit` call fails
- **THEN** system SHALL print a warning message (e.g., `⚠ Project status update failed — update manually`)
- **AND** system SHALL NOT fail or abort the overall `/gh-pr` command

#### Scenario: No linked issue present
- **WHEN** PR body contains no `Closes`, `Fixes`, or `Resolves` keyword
- **THEN** system SHALL skip the linked issue status step and continue without error
