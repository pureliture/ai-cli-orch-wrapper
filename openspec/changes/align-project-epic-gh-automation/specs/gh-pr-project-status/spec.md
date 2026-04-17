## MODIFIED Requirements

### Requirement: /gh-pr adds PR to PM Project and sets In Review status
The system SHALL, after creating a PR, explicitly add the PR to the PM Project and set its Status to "In Review" via `gh project item-edit`, without relying solely on the PostToolUse hook. It SHALL also resolve closing issue references reliably enough to move each linked issue to `"In Review"` during `/gh-pr` execution.

#### Scenario: PR added to Project on creation
- **WHEN** user invokes `/gh-pr` and PR is successfully created
- **THEN** system SHALL run `gh project item-add 3 --owner pureliture --url <pr_url>` to add the PR to Project #3
- **AND** system SHALL run `gh project item-edit` to set the PR item Status to "In Review"

#### Scenario: Linked issue status set to In Review from closing references
- **WHEN** PR body contains one or more closing references such as `Closes #N`, `Fixes #N`, or `Resolves #N`
- **THEN** system SHALL find the referenced issue items and set each Status to "In Review"

#### Scenario: Regression case for missed linked issue transition
- **WHEN** a PR is created with a valid closing issue reference but the linked issue is not yet present in Project #3
- **THEN** system SHALL add that issue to Project #3 if needed
- **AND** system SHALL still set the linked issue Status to "In Review"

#### Scenario: Idempotent operation
- **WHEN** PR or issue is already present in the Project
- **THEN** system SHALL update the Status without creating a duplicate item

#### Scenario: Project update failure does not block PR
- **WHEN** any `gh project item-add` or `gh project item-edit` call fails
- **THEN** system SHALL print a warning message (e.g., `⚠ Project status update failed — update manually`)
- **AND** system SHALL NOT fail or abort the overall `/gh-pr` command

#### Scenario: No linked issue present
- **WHEN** PR body contains no closing issue keyword
- **THEN** system SHALL skip the linked issue status step and continue without error
