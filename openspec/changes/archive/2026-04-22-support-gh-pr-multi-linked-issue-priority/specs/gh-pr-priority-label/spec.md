## MODIFIED Requirements

### Requirement: /gh-pr inherits priority label from linked issue
The system SHALL apply a single priority label (`p0`, `p1`, or `p2`) to the PR, resolving across all linked issues by selecting the highest available priority label and defaulting to `p1` when none are present.

#### Scenario: Priority label inherited from a single linked issue
- **WHEN** PR body contains one linked issue reference and that issue has a `p0`, `p1`, or `p2` label
- **THEN** system SHALL apply the same priority label to the PR via `gh pr edit --add-label <priority>`

#### Scenario: Highest priority wins across multiple linked issues
- **WHEN** PR body contains multiple linked issue references and those issues carry different priority labels
- **THEN** system SHALL apply the highest priority label to the PR using precedence `p0 > p1 > p2`

#### Scenario: Default priority when no linked issue priority exists
- **WHEN** none of the linked issues has a `p0`/`p1`/`p2` label, OR no linked issue is present
- **THEN** system SHALL apply `p1` as the default priority label to the PR

#### Scenario: Priority label not duplicated
- **WHEN** PR already has a priority label
- **THEN** system SHALL NOT add a second priority label
