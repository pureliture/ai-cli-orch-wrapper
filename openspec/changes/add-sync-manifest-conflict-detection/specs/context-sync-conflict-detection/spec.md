## ADDED Requirements

### Requirement: Detect drifted manifest-owned targets

The system SHALL detect when a manifest-owned sync target has been modified on disk since the previous successful sync.

#### Scenario: Target hash differs from manifest hash

- **WHEN** `.aco/sync-manifest.json` records a hash for a target path
- **AND** the target file exists on disk with content whose hash differs from the manifest hash
- **THEN** the sync plan SHALL mark that target output as `conflict`

#### Scenario: Target hash matches manifest hash

- **WHEN** `.aco/sync-manifest.json` records a hash for a target path
- **AND** the target file exists on disk with content whose hash matches the manifest hash
- **THEN** the sync plan SHALL NOT mark that target output as `conflict`

#### Scenario: Manifest-owned target is missing

- **WHEN** `.aco/sync-manifest.json` records a hash for a target path
- **AND** the target file does not exist on disk
- **THEN** the sync plan SHALL treat the target as recreatable generated output instead of a conflict

### Requirement: Block non-forced sync on conflicts

The system SHALL stop a normal `aco sync` run before overwriting any drifted manifest-owned target.

#### Scenario: Normal sync sees conflict

- **WHEN** `aco sync` is run without `--force`
- **AND** one or more planned outputs are marked `conflict`
- **THEN** the command SHALL exit non-zero
- **AND** the command SHALL report the conflicting target paths
- **AND** the command SHALL advise using `aco sync --force` to overwrite
- **AND** the command SHALL NOT overwrite conflicting targets

### Requirement: Force sync overwrites conflicts

The system SHALL allow `aco sync --force` to overwrite drifted manifest-owned targets and refresh manifest hashes.

#### Scenario: Force sync sees conflict

- **WHEN** `aco sync --force` is run
- **AND** one or more planned outputs are marked `conflict`
- **THEN** the command SHALL write the generated outputs to the conflicting target paths
- **AND** the command SHALL write an updated `.aco/sync-manifest.json`
- **AND** the updated manifest SHALL record hashes for the generated target content

### Requirement: Check mode reports conflicts

The system SHALL make `aco sync --check` fail when manifest-owned targets have drifted on disk.

#### Scenario: Check mode sees conflict

- **WHEN** `aco sync --check` is run
- **AND** one or more planned outputs are marked `conflict`
- **THEN** the command SHALL exit non-zero
- **AND** the command SHALL report the conflicting target paths
- **AND** the command SHALL NOT write target files or update the manifest
