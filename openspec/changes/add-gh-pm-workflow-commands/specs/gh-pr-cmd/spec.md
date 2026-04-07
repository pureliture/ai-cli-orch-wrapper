## ADDED Requirements

### Requirement: /gh-pr command creates a pull request
The system SHALL provide a `/gh-pr` Claude Code slash command that creates a GitHub PR in `pureliture/ai-cli-orch-wrapper` with a conventional commit title, `Closes #N` reference, a CI checklist body, and an Epic checkbox reminder.

#### Scenario: PR creation with issue reference
- **WHEN** user invokes `/gh-pr` with issue number N
- **THEN** system SHALL run `gh pr create --repo pureliture/ai-cli-orch-wrapper` with title derived from the current branch or provided input, body containing `Closes #N`

#### Scenario: CI checklist inclusion
- **WHEN** PR is created
- **THEN** PR body SHALL include a checklist section: `- [ ] npm test passes`, `- [ ] manual smoke test`, `- [ ] docs updated if needed`

#### Scenario: Epic checkbox reminder
- **WHEN** PR is created and a parent epic exists
- **THEN** PR body SHALL include a reminder line: `> Note: manually check parent epic #<N> checkbox after merge`

#### Scenario: Conventional commit title
- **WHEN** user invokes `/gh-pr`
- **THEN** PR title SHALL follow `<type>: <description>` format, matching the issue's conventional commit title
