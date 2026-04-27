## ADDED Requirements

### Requirement: Sync check reports provider-surface duplicates
The system SHALL make `aco sync --check` report duplicate provider command or skill exposure without writing files.

#### Scenario: Duplicate warning in check mode
- **WHEN** provider-surface duplicates are detected
- **AND** the user runs `aco sync --check`
- **THEN** the command SHALL print warnings that include provider name, exposed name, cause paths, and recommended action
- **AND** the command SHALL NOT update `.aco/sync-manifest.json`

#### Scenario: Non-strict duplicate warning does not block freshness check
- **WHEN** duplicate warnings are present
- **AND** generated outputs are otherwise current
- **AND** the user runs `aco sync --check` without strict mode
- **THEN** the command MAY exit 0
- **AND** the command SHALL still print the duplicate warning count and details

#### Scenario: Strict duplicate warning fails check
- **WHEN** duplicate warnings are present
- **AND** the user runs `aco sync --check --strict`
- **THEN** the command SHALL exit non-zero
- **AND** report that strict mode promoted duplicate warnings to failures

### Requirement: Sync command output separates generated, skipped, and external assets
The system SHALL report generated output actions separately from skipped or external asset observations.

#### Scenario: External assets are skipped
- **WHEN** `aco sync` sees OpenSpec or Superpowers skills
- **THEN** the command summary SHALL include skipped or external observation counts
- **AND** the command SHALL NOT count those assets as generated outputs

#### Scenario: Warning includes remediation
- **WHEN** `aco sync` reports a duplicate provider-surface warning
- **THEN** the warning SHALL include a recommended action such as removing a shared command-alias skill, keeping the provider-specific command, or running the cleanup command

### Requirement: Sync cleanup supports duplicate migration
The system SHALL provide a migration path to remove previously generated duplicate provider-surface assets.

#### Scenario: Cleanup dry run
- **WHEN** the user requests duplicate cleanup in dry-run mode
- **THEN** the command SHALL list duplicate paths that would be removed
- **AND** indicate whether each path is manifest-owned, external, unknown, or user-modified
- **AND** SHALL NOT delete files

#### Scenario: Force clean is required for ambiguous assets
- **WHEN** a cleanup target is not manifest-owned by ACO or has been modified since manifest recording
- **THEN** cleanup SHALL refuse to delete it without `--force-clean`
- **AND** the output SHALL explain why the asset is ambiguous
