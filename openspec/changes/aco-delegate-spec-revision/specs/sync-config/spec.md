## ADDED Requirements

### Requirement: Sync configuration is loaded from `.aco/sync.yaml`
The system SHALL load `.aco/sync.yaml` if present, or use a default-deny configuration if absent.

#### Scenario: Config file exists
- **WHEN** `.aco/sync.yaml` exists with `skills.include` and `skills.exclude` arrays
- **THEN** the system SHALL parse it with `js-yaml`
- **AND** apply the include/exclude rules during skill classification

#### Scenario: Config file missing
- **WHEN** `.aco/sync.yaml` does not exist
- **THEN** the system SHALL use a default configuration with empty `skills.include` and `skills.exclude: ['openspec-*', 'superpowers-*', 'gh-*']`
- **AND** continue without error

#### Scenario: Config read error
- **WHEN** `.aco/sync.yaml` exists but cannot be read (e.g., permission denied)
- **THEN** the system SHALL throw the error and stop sync

### Requirement: Glob matching supports wildcard patterns
The system SHALL match skill names against glob patterns using `*` as the only wildcard character.

#### Scenario: Exact match
- **WHEN** the pattern is `github-kanban-ops` and the skill name is `github-kanban-ops`
- **THEN** the match SHALL return `true`

#### Scenario: Prefix wildcard
- **WHEN** the pattern is `openspec-*` and the skill name is `openspec-apply-change`
- **THEN** the match SHALL return `true`
- **AND** the skill name `not-openspec` SHALL return `false`

#### Scenario: Suffix wildcard
- **WHEN** the pattern is `gh-*` and the skill name is `gh-issue`
- **THEN** the match SHALL return `true`
- **AND** the skill name `github-issue` SHALL return `false`

#### Scenario: Regex special characters are escaped
- **WHEN** the pattern contains `.` or `+` or other regex metacharacters
- **THEN** those characters SHALL be treated as literals, not regex operators

### Requirement: Exclude takes precedence over include
The system SHALL evaluate `skills.exclude` before `skills.include`, and a match in `exclude` SHALL block the skill regardless of `include`.

#### Scenario: Excluded skill is blocked despite being in include
- **WHEN** `skills.include` contains `gh-*` and `skills.exclude` contains `gh-issue`
- **THEN** the skill `gh-issue` SHALL be excluded
- **AND** the skill `gh-pr` SHALL be included
