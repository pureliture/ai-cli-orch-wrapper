## ADDED Requirements

### Requirement: setup-github-labels.sh includes new labels idempotently
The system SHALL update `scripts/setup-github-labels.sh` to create or update `sprint:v3`, `sprint:v4`, and `origin:review` labels using `gh label create --force` for idempotent execution.

#### Scenario: New labels are created on first run
- **WHEN** `bash scripts/setup-github-labels.sh` is run against a repo without these labels
- **THEN** `sprint:v3`, `sprint:v4`, and `origin:review` labels SHALL be created with correct colors and descriptions

#### Scenario: Existing labels are updated on re-run
- **WHEN** `bash scripts/setup-github-labels.sh` is run and labels already exist
- **THEN** the script SHALL NOT fail or produce errors
- **THEN** label color and description SHALL be updated to match the script definition (upsert behavior via `--force`)

#### Scenario: Label colors
- **WHEN** sprint labels are created
- **THEN** `sprint:v3` and `sprint:v4` SHALL use color `E9D5FF` (purple)

#### Scenario: origin:review label color
- **WHEN** `origin:review` label is created
- **THEN** it SHALL use color `BFDBFE` (blue) to distinguish it from type labels
