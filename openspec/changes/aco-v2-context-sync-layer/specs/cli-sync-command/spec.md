## ADDED Requirements

### Requirement: `aco sync` command
The system SHALL provide an `aco sync` command that explicitly synchronizes Claude Code project configuration into Codex and Gemini project configuration.

#### Scenario: Successful sync
- **WHEN** a user runs `aco sync` from the repository root
- **THEN** the system SHALL generate or update managed Codex and Gemini outputs
- **AND** write `.aco/sync-manifest.json`
- **AND** exit 0 when no fatal conflict occurs

#### Scenario: Sync from subdirectory
- **WHEN** a user runs `aco sync` from a subdirectory inside a Git repository
- **THEN** the system SHALL resolve the repository root
- **AND** read and write project-level files relative to that root

#### Scenario: Missing Claude sources
- **WHEN** no root `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/agents/`, `.claude/skills/`, or Claude hook source exists
- **THEN** `aco sync` SHALL fail with a clear "no sync sources found" message

### Requirement: Sync check mode
The system SHALL provide `aco sync --check` to detect stale or missing generated outputs without writing files.

#### Scenario: Outputs are current
- **WHEN** all generated outputs match the current Claude sources and manifest hashes
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

### Requirement: Sync dry-run mode
The system SHALL provide `aco sync --dry-run` to show planned changes without writing files.

#### Scenario: Planned changes
- **WHEN** a user runs `aco sync --dry-run`
- **THEN** the system SHALL compute the same transform plan as `aco sync`
- **AND** print created, updated, removed, skipped, and warning counts
- **AND** not modify any files

#### Scenario: Dry-run conflict
- **WHEN** a generated target has unowned user modifications
- **THEN** `aco sync --dry-run` SHALL report the conflict
- **AND** exit non-zero only if the same conflict would block a real sync

### Requirement: Sync force mode
The system SHALL provide an explicit force option for resolving generated target drift.

#### Scenario: Force overwrite generated target
- **WHEN** a manifest-owned generated target has changed and the user runs `aco sync --force`
- **THEN** the system SHALL overwrite the target with regenerated content
- **AND** SHALL update the manifest with the new target hash

#### Scenario: Force does not overwrite untracked files by default
- **WHEN** a target path exists but is not listed as a managed target in the manifest and has no managed block
- **THEN** `aco sync --force` SHALL NOT overwrite the file unless the target type explicitly supports managed block insertion

### Requirement: Sync command output
The system SHALL produce concise, actionable command output suitable for humans and automation.

#### Scenario: Human-readable summary
- **WHEN** `aco sync` completes
- **THEN** it SHALL print a summary including generated target counts, warnings, and manifest path

#### Scenario: Check failure output
- **WHEN** `aco sync --check` fails due to stale outputs or conflicts
- **THEN** it SHALL print the command required to refresh outputs
- **AND** include the files that caused the failure
