## MODIFIED Requirements

### Requirement: Sync check mode
The system SHALL provide `aco sync --check` to detect stale, missing, or duplicate generated outputs without writing files.

#### Scenario: Outputs are current
- **WHEN** all generated outputs match the current Claude sources and manifest hashes
- **AND** no duplicate provider-surface warnings are present
- **THEN** `aco sync --check` SHALL exit 0
- **AND** print that context sync is current

#### Scenario: Outputs are stale
- **WHEN** a Claude source file changed after the last manifest update
- **THEN** `aco sync --check` SHALL exit 1
- **AND** list the stale source and affected targets

#### Scenario: Target drift
- **WHEN** a manifest-owned target file was manually modified
- **THEN** `aco sync --check` SHALL exit 1
- **AND** report the target drift without rewriting the target

#### Scenario: Duplicate warnings present
- **WHEN** duplicate provider-surface warnings are detected
- **AND** the user runs `aco sync --check` without `--strict`
- **THEN** the command SHALL emit the warnings
- **AND** exit 1 if there are also stale outputs or conflicts
- **AND** exit 0 if the only issue is duplicate warnings

#### Scenario: Strict duplicate check fails
- **WHEN** duplicate provider-surface warnings are present
- **AND** the user runs `aco sync --check --strict`
- **THEN** the command SHALL exit non-zero
- **AND** the command SHALL NOT write files or update `.aco/sync-manifest.json`

## ADDED Requirements

### Requirement: Sync strict mode
The system SHALL provide `aco sync --check --strict` to promote duplicate provider-surface warnings to fatal errors.

#### Scenario: CI pipeline strict check
- **WHEN** `aco sync --check --strict` is run in CI
- **AND** any duplicate warnings are present
- **THEN** the command SHALL exit non-zero
- **AND** print all duplicate warnings with severity, source, and message

### Requirement: Sync duplicate cleanup
The system SHALL provide `aco sync --clean-duplicates` and `aco sync --force-clean` to remove duplicate generated assets safely.

#### Scenario: Clean manifest-owned duplicates
- **WHEN** the user runs `aco sync --clean-duplicates`
- **AND** a duplicate asset is recorded in the manifest with owner `aco`
- **THEN** the system SHALL remove the duplicate asset
- **AND** record the removal in the updated manifest

#### Scenario: Force clean ambiguous duplicates
- **WHEN** the user runs `aco sync --clean-duplicates --force-clean`
- **AND** a duplicate asset exists but is not recorded as ACO-owned in the manifest
- **THEN** the system SHALL remove the duplicate asset
- **AND** record a warning about the forced removal

#### Scenario: Refuse to clean non-owned duplicates
- **WHEN** the user runs `aco sync --clean-duplicates` without `--force-clean`
- **AND** a duplicate asset exists but is not recorded as ACO-owned
- **THEN** the system SHALL emit a warning refusing to clean
- **AND** suggest passing `--force-clean` to override
