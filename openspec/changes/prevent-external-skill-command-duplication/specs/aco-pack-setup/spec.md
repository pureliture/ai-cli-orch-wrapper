## ADDED Requirements

### Requirement: Pack install and setup are limited to ACO-owned assets
The `aco pack install` and `aco pack setup` flows SHALL install and synchronize only ACO-owned command pack and context sync assets.

#### Scenario: Pack setup does not install OpenSpec duplicates
- **WHEN** the user runs `aco pack setup`
- **THEN** the setup flow SHALL NOT create `.agents/skills/openspec-*`
- **AND** SHALL NOT create `.codex/skills/openspec-*`
- **AND** SHALL NOT create `.gemini/commands/opsx/`

#### Scenario: Pack setup does not install Superpowers duplicates
- **WHEN** the user runs `aco pack setup`
- **THEN** the setup flow SHALL NOT create `.agents/skills/superpowers-*`
- **AND** SHALL NOT create Superpowers command or skill adapters for Codex or Gemini

#### Scenario: Templates contain only ACO-owned commands
- **WHEN** `aco pack install` copies `templates/commands`
- **THEN** the copied command files SHALL be limited to ACO-owned command pack entries
- **AND** external OpenSpec or Superpowers commands SHALL NOT be installed from ACO templates

### Requirement: Provider-specific commands remain provider-specific
The system SHALL keep provider-specific command entrypoints on the provider-specific command surface rather than the shared skill surface.

#### Scenario: Gemini gh command remains Gemini-only
- **WHEN** the repository contains `.gemini/commands/gh-issue.toml`
- **THEN** `aco sync` and `aco pack setup` SHALL NOT create `.agents/skills/gh-issue/`
- **AND** Gemini SHALL keep `.gemini/commands/gh-issue.toml` as the command entrypoint

#### Scenario: Claude gh command remains Claude-only
- **WHEN** the repository contains `.claude/commands/gh-issue.md`
- **THEN** `aco sync` and `aco pack setup` SHALL NOT create `.agents/skills/gh-issue/`
- **AND** Claude SHALL keep `.claude/commands/gh-issue.md` as the command entrypoint

#### Scenario: Shared policy skill is retained
- **WHEN** `github-kanban-ops` is explicitly allowed as an ACO-owned shared policy skill
- **THEN** `aco sync` MAY create or update `.agents/skills/github-kanban-ops/`
- **AND** that shared skill SHALL NOT be treated as a command alias

### Requirement: Pack status separates ACO command pack and external integrations
The `aco pack status` output SHALL distinguish ACO-owned command pack status from observed external integration status.

#### Scenario: External integration is observed
- **WHEN** OpenSpec or Superpowers assets are present in the repository
- **THEN** `aco pack status` SHALL report them under external integrations
- **AND** SHALL NOT treat their absence as provider readiness failure

#### Scenario: ACO command pack status is reported separately
- **WHEN** `aco pack status` checks `.claude/commands/gh-*.md` and `templates/commands/gh-*.md`
- **THEN** the command SHALL report ACO command pack parity separately from OpenSpec or Superpowers observations
