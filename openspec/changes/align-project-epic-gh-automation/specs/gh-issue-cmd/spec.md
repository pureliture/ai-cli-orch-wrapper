## MODIFIED Requirements

### Requirement: /gh-issue slash command creates a GitHub issue
The system SHALL provide a `/gh-issue` Claude Code slash command that creates a GitHub issue in `pureliture/ai-cli-orch-wrapper` with conventional commit format title, appropriate labels including a priority label, explicit Project #3 Backlog assignment, and optional native parent epic linkage.

#### Scenario: Basic issue creation
- **WHEN** user invokes `/gh-issue` with a title, type, and sprint label
- **THEN** system runs `gh issue create --repo pureliture/ai-cli-orch-wrapper` with the provided title and labels (`type:<type>`, provided `sprint:v*`, `p0`/`p1`/`p2`)
- **AND** system SHALL add the created issue to Project #3 and set its Status to `Backlog`

#### Scenario: Title convention enforcement
- **WHEN** user invokes `/gh-issue`
- **THEN** the created issue title SHALL follow `<type>: <description>` format (e.g., `feat: add user auth`) with no `[Sprint V*]` or `[Task]` prefix

#### Scenario: Epic parent linking
- **WHEN** user invokes `/gh-issue` with a parent epic number
- **THEN** issue body SHALL include `Parent epic: #<N>` as the first line
- **AND** system SHALL attempt GitHub native sub-issue linkage for the created issue under the parent epic

#### Scenario: Native sub-issue linkage failure does not block issue creation
- **WHEN** the native sub-issue linkage mutation fails after the issue is created
- **THEN** system SHALL print a warning and continue without rolling back the created issue

#### Scenario: Project Backlog assignment
- **WHEN** issue is created
- **THEN** system SHALL add the issue to GitHub Project #3 (`PVT_kwHOA6302M4BT5fA`)
- **AND** system SHALL set the Project item status to `Backlog`

#### Scenario: Priority label applied at creation
- **WHEN** user invokes `/gh-issue`
- **THEN** system SHALL prompt for or infer a `p0`/`p1`/`p2` priority label and include it in the `gh issue create --label` argument
