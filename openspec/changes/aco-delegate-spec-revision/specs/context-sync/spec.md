## MODIFIED Requirements

### Requirement: Shared skill directory synchronization
The system SHALL synchronize only explicitly allowed ACO-owned Claude Code skills into the shared `.agents/skills/` location. External, provider-specific, and unknown skills SHALL be skipped and recorded in the manifest.

#### Scenario: Skill with bundled assets is allowed
- **WHEN** `.claude/skills/github-kanban-ops/SKILL.md` exists with `scripts/` or `references/` children
- **AND** the skill is classified as ACO-owned
- **THEN** `aco sync` SHALL recursively copy the entire directory to `.agents/skills/github-kanban-ops/`
- **AND** preserve executable scripts, references, templates, and metadata files
- **AND** record the target in `manifest.targets` with owner `aco`

#### Scenario: External skill is skipped
- **WHEN** `.claude/skills/openspec-apply-change/SKILL.md` exists
- **AND** the skill is classified as external
- **THEN** `aco sync` SHALL NOT create `.agents/skills/openspec-apply-change/`
- **AND** SHALL record the skipped skill in `manifest.skipped` with owner `external`, reason, and path

#### Scenario: Non-skill directory
- **WHEN** a directory under `.claude/skills/` does not contain `SKILL.md`
- **THEN** `aco sync` SHALL skip that directory
- **AND** record a non-fatal warning in the sync manifest

#### Scenario: Stale managed skill
- **WHEN** a previously generated skill target is listed in `.aco/sync-manifest.json` as ACO-owned
- **AND** the source skill no longer exists or is no longer eligible
- **THEN** `aco sync` SHALL remove the stale target only if the target hash still matches the manifest record
- **AND** if the hash does not match, emit a warning and skip removal

#### Scenario: Legacy manifest target
- **WHEN** a target exists only in `manifest.targetHashes` (legacy v1) and not in `manifest.targets`
- **AND** the source skill no longer exists or is no longer eligible
- **THEN** `aco sync` SHALL assume legacy ownership and check hash before removal
- **AND** emit a warning about the legacy target

### Requirement: Sync manifest ownership
The system SHALL track generated file ownership, hashes, transformer versions, warnings, and skipped assets in `.aco/sync-manifest.json` using schema version `2`.

#### Scenario: Manifest creation
- **WHEN** `aco sync` writes generated outputs
- **THEN** the system SHALL create or update `.aco/sync-manifest.json`
- **AND** include `version: '2'`, `generatedAt`, `sourceHashes`, `targetHashes` (legacy), `targets` (ownership-aware records), `skipped` (skipped asset records), and `warnings`

#### Scenario: User-modified generated target
- **WHEN** a target listed in the manifest has been modified outside aco since the previous sync
- **THEN** `aco sync` SHALL fail before overwriting the target unless the user passes an explicit force option

#### Scenario: Warning visibility
- **WHEN** hook, agent, or skill conversion loses unsupported semantics
- **THEN** the manifest SHALL include a warning with source path, target tool, field or event name, and reason

#### Scenario: Skipped external asset
- **WHEN** an external or provider-specific skill is discovered and skipped
- **THEN** the manifest SHALL record it in `skipped` with path, owner, kind, and reason

## ADDED Requirements

### Requirement: Source discovery remains broad
The system SHALL continue to discover all `.claude/skills/*/SKILL.md` files regardless of ownership, so that diagnostics and duplicate detection can see them.

#### Scenario: External skill is discovered but not synced
- **WHEN** `aco sync` discovers `.claude/skills/openspec-test/SKILL.md`
- **THEN** the source SHALL be included in `plan.sources`
- **AND** the skill SHALL be classified and skipped during output planning
- **AND** duplicate detection SHALL still see the source path for diagnostics
