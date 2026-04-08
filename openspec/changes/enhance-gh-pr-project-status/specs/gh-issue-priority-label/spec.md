## ADDED Requirements

### Requirement: /gh-issue applies priority label at creation time
The system SHALL prompt for or infer a priority label (`p0`, `p1`, or `p2`) and apply it to the issue at creation time via `gh issue create --label`.

#### Scenario: Priority label applied during issue creation
- **WHEN** user invokes `/gh-issue`
- **THEN** system SHALL include one of `p0`, `p1`, or `p2` in the `--label` argument of `gh issue create`

#### Scenario: Priority inferred from description
- **WHEN** user provides issue description that implies urgency (e.g., "critical", "blocking")
- **THEN** system MAY infer `p0` and apply it without prompting

#### Scenario: Default priority when not specified
- **WHEN** user does not specify priority and no urgency is implied
- **THEN** system SHALL default to `p1`
