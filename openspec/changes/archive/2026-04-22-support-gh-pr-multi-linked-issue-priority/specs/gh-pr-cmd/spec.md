## MODIFIED Requirements

### Requirement: /gh-pr command creates a pull request
The system SHALL provide a `/gh-pr` Claude Code slash command that creates a GitHub PR in `pureliture/ai-cli-orch-wrapper` with a conventional commit title, one or more closing issue references, a CI checklist body, an Epic checkbox reminder, explicit PM Project status management, and tracking label inheritance (priority, type, area, and origin).

#### Scenario: PR creation with issue reference
- **WHEN** user invokes `/gh-pr` with issue number N
- **THEN** system SHALL run `gh pr create --repo pureliture/ai-cli-orch-wrapper` with title derived from the current branch or provided input
- **AND** the PR body SHALL contain at least one closing keyword reference for the linked issue

#### Scenario: CI checklist inclusion
- **WHEN** PR is created
- **THEN** PR body SHALL include a checklist section: `- [ ] npm test passes`, `- [ ] manual smoke test`, `- [ ] docs updated if needed`

#### Scenario: Epic checkbox reminder
- **WHEN** PR is created and a parent epic exists
- **THEN** PR body SHALL include a reminder line: `> Note: manually check parent epic #<N> checkbox after merge`

#### Scenario: Conventional commit title
- **WHEN** user invokes `/gh-pr`
- **THEN** PR title SHALL follow `<type>(<scope>): <description>` format, matching the issue's conventional commit title and identifying the affected area

#### Scenario: PR added to PM Project with In Review status
- **WHEN** PR is successfully created
- **THEN** system SHALL add the PR to Project #3 and set its Status to "In Review"

#### Scenario: Multiple linked issues are parsed from PR body
- **WHEN** PR body contains multiple `Closes #N`, `Fixes #N`, or `Resolves #N` references
- **THEN** system SHALL collect every referenced issue number in body order
- **AND** system SHALL de-duplicate repeated references before passing the linked issue list to downstream status and label steps

#### Scenario: Linked issues set to In Review
- **WHEN** PR body contains one or more `Closes #N`, `Fixes #N`, or `Resolves #N` references
- **THEN** system SHALL set each linked issue's Project Status to "In Review"

#### Scenario: Priority label applied to PR
- **WHEN** PR is created
- **THEN** system SHALL apply a `p0`/`p1`/`p2` priority label resolved from linked issues or defaulting to `p1`
