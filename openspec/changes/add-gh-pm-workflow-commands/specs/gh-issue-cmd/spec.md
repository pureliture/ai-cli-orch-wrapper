## ADDED Requirements

### Requirement: /gh-issue slash command creates a GitHub issue
The system SHALL provide a `/gh-issue` Claude Code slash command that creates a GitHub issue in `pureliture/ai-cli-orch-wrapper` with conventional commit format title, appropriate labels, and automatic Project #3 Backlog assignment.

#### Scenario: Basic issue creation
- **WHEN** user invokes `/gh-issue` with a title and type
- **THEN** system runs `gh issue create --repo pureliture/ai-cli-orch-wrapper` with the provided title, labels (`type:<type>`, `sprint:v3`), and assigns it to Project #3 Backlog

#### Scenario: Title convention enforcement
- **WHEN** user invokes `/gh-issue`
- **THEN** the created issue title SHALL follow `<type>: <description>` format (e.g., `feat: add user auth`) with no `[Sprint V*]` or `[Task]` prefix

#### Scenario: Epic parent linking
- **WHEN** user invokes `/gh-issue` with a parent epic number
- **THEN** issue body SHALL include `Parent epic: #<N>` as the first line

#### Scenario: Project Backlog assignment
- **WHEN** issue is created
- **THEN** system SHALL add the issue to GitHub Project #3 (`PVT_kwHOA6302M4BT5fA`) with status "Backlog" using `gh project item-add`
