## MODIFIED Requirements

### Requirement: /gh-issue applies priority label at creation time
The system SHALL prompt for or infer a priority label (`p0`, `p1`, or `p2`) during `/gh-issue` creation, apply it to the issue via `gh issue create --label`, and mirror the same priority to the Project `Priority` field after the issue is added to Project #3.

#### Scenario: Priority label applied during issue creation
- **WHEN** user invokes `/gh-issue`
- **THEN** system SHALL include one of `p0`, `p1`, or `p2` in the `--label` argument of `gh issue create`

#### Scenario: Priority mirrored to Project field
- **WHEN** the created issue is added to Project #3
- **THEN** system SHALL set the Project `Priority` field to the matching option `P0`, `P1`, or `P2`

#### Scenario: Priority inferred from description
- **WHEN** user provides issue description that implies urgency (e.g., "critical", "blocking")
- **THEN** system MAY infer `p0` and apply it without prompting

#### Scenario: Default priority when not specified
- **WHEN** user does not specify priority and no urgency is implied
- **THEN** system SHALL default to `p1`
