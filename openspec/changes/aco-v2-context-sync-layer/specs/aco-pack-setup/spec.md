## ADDED Requirements

### Requirement: Pack setup runs context sync
The `aco pack setup` flow SHALL run context sync after installing Claude Code command and prompt templates.

#### Scenario: Setup installs and syncs
- **WHEN** a user runs `aco pack setup`
- **THEN** the setup flow SHALL install the existing pack artifacts
- **AND** run the same transform logic as `aco sync`
- **AND** report generated Codex/Gemini context outputs in the setup summary

#### Scenario: Setup sync warning
- **WHEN** context sync completes with non-fatal conversion warnings
- **THEN** `aco pack setup` SHALL print the warning count and manifest path
- **AND** continue unless a fatal conflict occurred

### Requirement: Pack setup preserves idempotency
The `aco pack setup` sync step SHALL be idempotent and safe to rerun.

#### Scenario: Re-running setup
- **WHEN** a user runs `aco pack setup` twice without changing source files
- **THEN** the second run SHALL not create duplicate managed blocks
- **AND** SHALL report that generated outputs are current or unchanged

#### Scenario: Existing user files
- **WHEN** root `AGENTS.md` or `GEMINI.md` already contains user-authored content
- **THEN** `aco pack setup` SHALL preserve user-authored content outside managed blocks
- **AND** insert or update only the managed generated block

### Requirement: Pack setup conflict handling
The `aco pack setup` flow SHALL fail before overwriting unowned or drifted generated targets.

#### Scenario: Drifted target
- **WHEN** a manifest-owned generated target has been manually modified
- **THEN** `aco pack setup` SHALL fail with a conflict message
- **AND** instruct the user to run `aco sync --check`, `aco sync`, or `aco sync --force` as appropriate

#### Scenario: Untracked target directory
- **WHEN** a target directory such as `.agents/skills/<skill>/` exists but is not manifest-owned
- **THEN** `aco pack setup` SHALL not overwrite it
- **AND** SHALL report the conflicting path
