## MODIFIED Requirements

### Requirement: /gh-issue slash command creates a GitHub issue
The system SHALL provide a `/gh-issue` Claude Code slash command that creates a GitHub issue in `pureliture/ai-cli-orch-wrapper` with conventional commit format title, appropriate labels including a priority label, and automatic Project #3 Backlog assignment.

#### Scenario: Basic issue creation
- **WHEN** user invokes `/gh-issue` with a title, type, and sprint label
- **THEN** system runs `gh issue create --repo pureliture/ai-cli-orch-wrapper` with the provided title, labels (`type:<type>`, provided `sprint:v*`, `p0`/`p1`/`p2`), and assigns it to Project #3 Backlog

#### Scenario: Title convention enforcement
- **WHEN** user invokes `/gh-issue`
- **THEN** the created issue title SHALL follow `<type>: <description>` format (e.g., `feat: add user auth`) with no `[Sprint V*]` or `[Task]` prefix

#### Scenario: Epic parent linking
- **WHEN** user invokes `/gh-issue` with a parent epic number
- **THEN** issue body SHALL include `Parent epic: #<N>` as the first line

#### Scenario: Project Backlog assignment
- **WHEN** issue is created
- **THEN** system SHALL add the issue to GitHub Project #3 (`PVT_kwHOA6302M4BT5fA`) with status "Backlog" using `gh project item-add`

#### Scenario: Priority label applied at creation
- **WHEN** user invokes `/gh-issue`
- **THEN** system SHALL prompt for or infer a `p0`/`p1`/`p2` priority label and include it in the `gh issue create --label` argument
