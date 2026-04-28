## MODIFIED Requirements

### Requirement: Pack setup runs context sync
The `aco pack setup` flow SHALL run context sync after installing Claude Code command and prompt templates, scoped to ACO-owned assets only.

#### Scenario: Setup installs and syncs
- **WHEN** a user runs `aco pack setup`
- **THEN** the setup flow SHALL install the existing pack artifacts
- **AND** run the same transform logic as `aco sync`
- **AND** report generated Codex/Gemini context outputs in the setup summary
- **AND** external or provider-specific skills SHALL be skipped without error

#### Scenario: Setup sync warning
- **WHEN** context sync completes with non-fatal conversion warnings or duplicate warnings
- **THEN** `aco pack setup` SHALL print the warning count and manifest path
- **AND** continue unless a fatal conflict occurred

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

## ADDED Requirements

### Requirement: Pack setup does not spread external assets
The `aco pack setup` flow SHALL NOT create copies of OpenSpec, Superpowers, or command-alias skills in `.agents/skills/`, `.codex/skills/`, or `.gemini/commands/opsx/`.

#### Scenario: External skills remain external
- **WHEN** `aco pack setup` discovers `.claude/skills/openspec-apply-change/SKILL.md`
- **THEN** the setup flow SHALL classify it as external
- **AND** SHALL NOT create `.agents/skills/openspec-apply-change/`
- **AND** SHALL record the skipped asset in the manifest

#### Scenario: Command aliases remain provider-specific
- **WHEN** `aco pack setup` discovers `.claude/skills/gh-issue/SKILL.md`
- **THEN** the setup flow SHALL classify it as provider-specific
- **AND** SHALL NOT create `.agents/skills/gh-issue/`
- **AND** SHALL keep Gemini `gh-issue` in `.gemini/commands/` and Claude `gh-issue` in `.claude/commands/`
