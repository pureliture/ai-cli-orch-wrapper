## ADDED Requirements

### Requirement: External provider assets are classified
The system SHALL classify discovered provider-surface assets as ACO-owned, provider-specific, external, or unknown before planning generated outputs or cleanup.

#### Scenario: OpenSpec skill is external
- **WHEN** `aco sync` discovers `.claude/skills/openspec-apply-change/SKILL.md`
- **THEN** the system SHALL classify the skill as external provider `openspec`
- **AND** the system SHALL NOT plan a shared `.agents/skills/openspec-apply-change/` output
- **AND** the manifest SHALL record the asset with action `ignored` or `skipped`

#### Scenario: Superpowers skill is external
- **WHEN** `aco sync` discovers a skill named `superpowers-*`, `using-superpowers`, `brainstorming`, `writing-plans`, or `executing-plans`
- **THEN** the system SHALL classify the skill as external provider `superpowers`
- **AND** the system SHALL NOT plan a shared `.agents/skills/<skill>/` output

#### Scenario: Command alias skill is provider-specific
- **WHEN** `aco sync` discovers `.claude/skills/gh-issue/SKILL.md`
- **THEN** the system SHALL classify the skill as a command-alias skill
- **AND** the system SHALL NOT plan `.agents/skills/gh-issue/` as a shared skill output

### Requirement: Duplicate provider exposure is detected
The system SHALL detect when a provider can expose the same command or skill name from more than one provider surface.

#### Scenario: Gemini command and shared skill collide
- **WHEN** `.gemini/commands/gh-issue.toml` exists
- **AND** `.agents/skills/gh-issue/SKILL.md` exists
- **THEN** `aco sync --check` SHALL emit a duplicate provider-surface warning for provider `gemini`
- **AND** the warning SHALL include the exposed name `gh-issue`
- **AND** the warning SHALL include both source file paths
- **AND** the warning SHALL recommend removing the shared command-alias skill or keeping only the Gemini command

#### Scenario: OpenSpec duplicate assets are detected
- **WHEN** `.gemini/commands/opsx/apply.toml` exists
- **AND** `.codex/skills/openspec-apply-change/SKILL.md` exists
- **AND** `.agents/skills/openspec-apply-change/SKILL.md` exists
- **THEN** `aco sync --check` SHALL emit an external asset duplicate warning for provider `openspec`
- **AND** the warning SHALL include the duplicated surfaces and recommended cleanup path

#### Scenario: Strict duplicate check fails
- **WHEN** duplicate provider-surface warnings are present
- **AND** the user runs `aco sync --check --strict`
- **THEN** the command SHALL exit non-zero
- **AND** the command SHALL NOT write files or update `.aco/sync-manifest.json`

### Requirement: Duplicate cleanup is safe
The system SHALL remove duplicate generated assets only when ownership and content safety are established.

#### Scenario: Manifest-owned duplicate is cleanable
- **WHEN** a duplicate asset path is recorded in `.aco/sync-manifest.json` with owner `aco`
- **AND** the file or directory hash on disk matches the manifest record
- **THEN** cleanup MAY remove the duplicate asset without requiring `--force-clean`
- **AND** the manifest SHALL record the removal

#### Scenario: Unknown duplicate requires explicit force clean
- **WHEN** a duplicate asset exists but is not recorded as ACO-owned in `.aco/sync-manifest.json`
- **THEN** cleanup SHALL warn that ownership is unclear
- **AND** cleanup SHALL NOT delete the asset unless the user passes an explicit force-clean option

#### Scenario: External source skills are never deleted
- **WHEN** cleanup detects `.claude/skills/openspec-*` or `.claude/skills/superpowers-*`
- **THEN** cleanup SHALL NOT delete those directories
- **AND** cleanup SHALL report them as upstream-managed external assets
