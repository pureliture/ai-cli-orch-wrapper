## ADDED Requirements

### Requirement: /gh-pr inherits priority label from linked issue
The system SHALL apply a priority label (`p0`, `p1`, or `p2`) to the PR, inheriting from the linked issue when available, defaulting to `p1` otherwise.

#### Scenario: Priority label inherited from linked issue
- **WHEN** PR body contains `Closes #N` and issue #N has a `p0`, `p1`, or `p2` label
- **THEN** system SHALL apply the same priority label to the PR via `gh pr edit --add-label <priority>`

#### Scenario: Default priority when no linked issue priority exists
- **WHEN** linked issue has no `p0`/`p1`/`p2` label, OR no linked issue is present
- **THEN** system SHALL apply `p1` as the default priority label to the PR

#### Scenario: Priority label not duplicated
- **WHEN** PR already has a priority label
- **THEN** system SHALL NOT add a second priority label
