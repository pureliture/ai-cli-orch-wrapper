## ADDED Requirements

### Requirement: Shared skill sync uses explicit allow policy
The system SHALL synchronize only explicitly allowed ACO-owned shared policy or reference skills into `.agents/skills/`.

#### Scenario: ACO-owned policy skill is allowed
- **WHEN** `.claude/skills/github-kanban-ops/SKILL.md` exists
- **AND** the skill is allowed by frontmatter or `.aco/sync.yaml`
- **THEN** `aco sync` SHALL recursively copy the entire skill directory to `.agents/skills/github-kanban-ops/`
- **AND** preserve bundled scripts, references, templates, metadata, and executable bits where supported

#### Scenario: OpenSpec skill is skipped
- **WHEN** `.claude/skills/openspec-apply-change/SKILL.md` exists
- **THEN** `aco sync` SHALL NOT create `.agents/skills/openspec-apply-change/`
- **AND** the skipped asset SHALL be recorded in the manifest as external or skipped

#### Scenario: Command alias skill is skipped
- **WHEN** `.claude/skills/gh-pr/SKILL.md` exists
- **THEN** `aco sync` SHALL NOT create `.agents/skills/gh-pr/`
- **AND** the skipped asset SHALL be recorded with a command-alias classification

### Requirement: ACO-owned metadata controls skill sync eligibility
The system SHALL support skill sync ownership metadata through skill frontmatter and `.aco/sync.yaml`.

#### Scenario: Skill without ACO ownership is denied by default
- **WHEN** `.claude/skills/local-helper/SKILL.md` exists
- **AND** the skill has no `x-aco-owned: true` frontmatter
- **AND** `.aco/sync.yaml` does not include the skill
- **THEN** `aco sync` SHALL NOT copy the skill into `.agents/skills/local-helper/`
- **AND** the manifest SHALL record the skill as skipped or unknown local source

#### Scenario: Sync config include allows a skill
- **WHEN** `.aco/sync.yaml` contains `skills.include` with `github-kanban-ops`
- **AND** `.claude/skills/github-kanban-ops/SKILL.md` exists
- **THEN** `aco sync` SHALL treat `github-kanban-ops` as sync-eligible even if frontmatter ownership metadata is absent

#### Scenario: Sync config exclude overrides include and frontmatter
- **WHEN** `.aco/sync.yaml` contains `skills.include` with `gh-*`
- **AND** `.aco/sync.yaml` contains `skills.exclude` with `gh-*`
- **AND** `.claude/skills/gh-issue/SKILL.md` has `x-aco-owned: true`
- **THEN** `aco sync` SHALL NOT copy `gh-issue` into `.agents/skills/gh-issue/`
- **AND** the manifest SHALL record that the exclude rule won

#### Scenario: Glob patterns are supported
- **WHEN** `.aco/sync.yaml` contains exclude patterns `openspec-*`, `superpowers-*`, and `gh-*`
- **THEN** `aco sync` SHALL apply those patterns to discovered skill names
- **AND** matching skills SHALL be skipped before output planning

### Requirement: Manifest records ownership-aware sync state
The system SHALL write ownership-aware manifest records for generated, skipped, and external assets.

#### Scenario: ACO-owned shared skill is recorded
- **WHEN** `aco sync` writes `.agents/skills/github-kanban-ops/`
- **THEN** `.aco/sync-manifest.json` SHALL record the target owner as `aco`
- **AND** record the kind as `shared-skill`
- **AND** record the source path `.claude/skills/github-kanban-ops`
- **AND** record target hashes or equivalent content integrity data

#### Scenario: External asset is recorded but not overwritten
- **WHEN** `aco sync` detects `.claude/skills/openspec-apply-change/`
- **THEN** `.aco/sync-manifest.json` SHALL record the asset owner as `external`
- **AND** record provider `openspec`
- **AND** record action `ignored` or `skipped`
- **AND** `aco sync --force` SHALL NOT overwrite or adopt the asset

#### Scenario: External asset is not adopted implicitly
- **WHEN** an external asset exists in a provider surface
- **AND** the user runs `aco sync --force`
- **THEN** the system SHALL keep the asset classified as external
- **AND** SHALL NOT convert it into an ACO-owned target without an explicit adopt option

### Requirement: Stale shared skill removal respects ownership
The system SHALL remove stale shared skill targets only when they are manifest-owned ACO outputs and safe to delete.

#### Scenario: Stale ACO-owned skill target is removed
- **WHEN** `.aco/sync-manifest.json` records `.agents/skills/old-aco-skill/` as owner `aco`
- **AND** the source `.claude/skills/old-aco-skill/` no longer exists
- **AND** the target content hash matches the manifest
- **THEN** `aco sync` SHALL remove the stale target

#### Scenario: Stale external-looking target is not removed automatically
- **WHEN** `.agents/skills/openspec-apply-change/` exists
- **AND** the path is not recorded as owner `aco` in the manifest
- **THEN** `aco sync` SHALL NOT remove the path automatically
- **AND** `aco sync --check` SHALL report cleanup guidance instead
