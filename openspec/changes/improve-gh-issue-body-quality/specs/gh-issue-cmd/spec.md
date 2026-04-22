## MODIFIED Requirements

### Requirement: /gh-issue slash command creates a GitHub issue
The system SHALL provide a `/gh-issue` Claude Code slash command that creates a GitHub issue in `pureliture/ai-cli-orch-wrapper` with conventional commit format title, appropriate labels including a priority label, an actionable structured body, explicit Project #3 Backlog assignment, and optional native parent epic linkage.

#### Scenario: Basic issue creation
- **WHEN** user invokes `/gh-issue` with a title, type, sprint label, and enough body context
- **THEN** system runs `gh issue create --repo pureliture/ai-cli-orch-wrapper` with the provided title and labels (`type:<type>`, provided `sprint:v*`, `p0`/`p1`/`p2`)
- **AND** system SHALL use `--body-file` to pass the generated Markdown issue body
- **AND** system SHALL add the created issue to Project #3 and set its Status to `Backlog`

#### Scenario: Structured body creation
- **WHEN** user invokes `/gh-issue`
- **THEN** the issue body SHALL include `## Purpose`, `## Scope & Requirements`, and `## Acceptance Criteria`
- **AND** `## Scope & Requirements` SHALL contain concrete checklist items unless the issue is a tiny bug
- **AND** `## Acceptance Criteria` SHALL contain at least one observable completion condition

#### Scenario: Korean body by default
- **WHEN** user invokes `/gh-issue` without explicitly requesting another language
- **THEN** issue body prose and checklist item descriptions SHALL be written in Korean
- **AND** conventional title prefixes, labels, code identifiers, file paths, command names, and established Markdown headings MAY remain in their original language

#### Scenario: Missing body context
- **WHEN** available user input is insufficient to fill required body sections concretely
- **THEN** the command SHALL ask concise follow-up questions before creating the issue
- **AND** the command SHALL ask no more than two follow-up questions in one turn

#### Scenario: Placeholder rejection
- **WHEN** the generated issue body still contains placeholder text such as `<...>`, `TBD`, or `TODO`
- **THEN** the command SHALL revise the body before calling `gh issue create`

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
