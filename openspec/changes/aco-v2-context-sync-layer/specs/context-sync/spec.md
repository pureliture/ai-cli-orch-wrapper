## ADDED Requirements

### Requirement: Source discovery for context sync
The system SHALL discover Claude Code source configuration from the repository root and `.claude/` directory using a deterministic source order.

#### Scenario: Root context is present
- **WHEN** `aco sync` runs in a repository containing root `CLAUDE.md`
- **THEN** the sync input SHALL include root `CLAUDE.md` before optional `.claude/CLAUDE.md` and `.claude/rules/*.md`

#### Scenario: Optional source files are missing
- **WHEN** `.claude/CLAUDE.md` or `.claude/rules/` does not exist
- **THEN** `aco sync` SHALL continue without treating the missing optional source as an error

#### Scenario: Hook source discovery
- **WHEN** `.claude/settings.json` contains a `hooks` object
- **THEN** the sync input SHALL use `.claude/settings.json` as the primary hook source
- **AND** `.claude/hooks.json` SHALL be used only when `.claude/settings.json` has no hook configuration

### Requirement: Project guidance generation
The system SHALL generate Codex and Gemini project guidance from Claude source context without overwriting user-authored content outside managed blocks.

#### Scenario: AGENTS.md generation
- **WHEN** `aco sync` runs with Claude context sources
- **THEN** the system SHALL write or update an `ACO GENERATED CONTEXT` managed block in root `AGENTS.md`
- **AND** content outside that managed block SHALL remain unchanged

#### Scenario: GEMINI.md generation
- **WHEN** `aco sync` runs with Claude context sources
- **THEN** the system SHALL write or update an `ACO GENERATED CONTEXT` managed block in root `GEMINI.md`
- **AND** content outside that managed block SHALL remain unchanged

#### Scenario: Managed block refresh
- **WHEN** a managed block already exists and Claude source context changes
- **THEN** `aco sync` SHALL replace only the managed block content
- **AND** update the manifest hashes for the changed sources and targets

### Requirement: Shared skill directory synchronization
The system SHALL synchronize Claude Code skills as recursive skill directories into the shared `.agents/skills/` location supported by Codex and Gemini.

#### Scenario: Skill with bundled assets
- **WHEN** `.claude/skills/github-jira-ops/SKILL.md` exists with `scripts/` or `references/` children
- **THEN** `aco sync` SHALL recursively copy the entire `github-jira-ops` directory to `.agents/skills/github-jira-ops/`
- **AND** preserve executable scripts, references, templates, and metadata files

#### Scenario: Non-skill directory
- **WHEN** a directory under `.claude/skills/` does not contain `SKILL.md`
- **THEN** `aco sync` SHALL skip that directory
- **AND** record a non-fatal warning in the sync manifest

#### Scenario: Stale managed skill
- **WHEN** a previously generated skill target is listed in `.aco/sync-manifest.json` but the source skill no longer exists
- **THEN** `aco sync` SHALL remove the stale target only if the target hash still matches the manifest-owned generated content

### Requirement: Codex custom agent generation
The system SHALL transform `.claude/agents/*.md` into Codex custom agent TOML files under `.codex/agents/`.

#### Scenario: Basic Codex agent transform
- **WHEN** `.claude/agents/reviewer.md` contains `id`, `when`, frontmatter, and Markdown body
- **THEN** `aco sync` SHALL create `.codex/agents/reviewer.toml`
- **AND** map `id` to `name`, `when` to `description`, resolved model to `model`, and body plus `promptSeedFile` content to `developer_instructions`

#### Scenario: Codex read-only mapping
- **WHEN** a Claude agent has `workspaceMode: read-only` or `permissionProfile: restricted`
- **THEN** the generated Codex agent SHALL set `sandbox_mode = "read-only"`

#### Scenario: Codex edit mapping
- **WHEN** a Claude agent has `workspaceMode: edit`
- **THEN** the generated Codex agent SHALL set `sandbox_mode = "workspace-write"` unless `permissionProfile: unrestricted` explicitly maps to `danger-full-access`

#### Scenario: Codex reasoning effort mapping
- **WHEN** a Claude agent has `reasoningEffort`
- **THEN** the generated Codex agent SHALL include `model_reasoning_effort` only if the target Codex custom-agent config supports that key
- **AND** unsupported reasoning effort mappings SHALL be recorded as warnings rather than emitted as unsupported runtime CLI flags

### Requirement: Gemini custom agent generation
The system SHALL transform `.claude/agents/*.md` into Gemini custom agent Markdown files under `.gemini/agents/`.

#### Scenario: Basic Gemini agent transform
- **WHEN** `.claude/agents/researcher.md` contains `id`, `when`, frontmatter, and Markdown body
- **THEN** `aco sync` SHALL create `.gemini/agents/researcher.md`
- **AND** map `id` to `name`, `when` to `description`, `kind` to `local`, resolved model to `model`, and body plus `promptSeedFile` content to the Markdown body

#### Scenario: Gemini turn limit mapping
- **WHEN** a Claude agent has `turnLimit`
- **THEN** the generated Gemini agent SHALL map it to `max_turns`

#### Scenario: Gemini read-only best-effort mapping
- **WHEN** a Claude agent has `workspaceMode: read-only` or `permissionProfile: restricted`
- **THEN** the generated Gemini agent SHALL restrict tools to read/search-oriented tools when supported
- **AND** record a manifest warning that Gemini read-only enforcement is best-effort if equivalent enforcement is unavailable

#### Scenario: Gemini unsupported reasoning effort
- **WHEN** a Claude agent has `reasoningEffort`
- **THEN** the generated Gemini agent SHALL omit unsupported reasoning-effort fields
- **AND** record the omitted field in the manifest warning list

### Requirement: Hook transformation
The system SHALL transform representable Claude Code hooks into Codex and Gemini hook configuration and warn about non-equivalent semantics.

#### Scenario: Codex hook output
- **WHEN** `.claude/settings.json` contains a supported hook event
- **THEN** `aco sync` SHALL write a matching `.codex/hooks.json` entry
- **AND** ensure Codex hooks are enabled through managed `.codex/config.toml` configuration

#### Scenario: Gemini hook output
- **WHEN** `.claude/settings.json` contains a supported hook event
- **THEN** `aco sync` SHALL write a matching `.gemini/settings.json` hook entry
- **AND** convert timeout values to Gemini's millisecond timeout unit

#### Scenario: Async hook warning
- **WHEN** a Claude hook contains `async: true`
- **THEN** `aco sync` SHALL record a warning for Codex and Gemini targets because their hooks run synchronously in the agent loop
- **AND** the generated target hook SHALL NOT claim fire-and-forget semantics

#### Scenario: Unsupported hook event
- **WHEN** a Claude hook event cannot be represented in the target CLI
- **THEN** `aco sync` SHALL skip that hook for the target CLI
- **AND** record the skipped event and reason in the sync manifest

### Requirement: Sync manifest ownership
The system SHALL track generated file ownership, hashes, transformer versions, and warnings in `.aco/sync-manifest.json`.

#### Scenario: Manifest creation
- **WHEN** `aco sync` writes generated outputs
- **THEN** the system SHALL create or update `.aco/sync-manifest.json`
- **AND** include source paths, target paths, source hashes, target hashes, transformer version, generated timestamp, and warning entries

#### Scenario: User-modified generated target
- **WHEN** a target listed in the manifest has been modified outside aco since the previous sync
- **THEN** `aco sync` SHALL fail before overwriting the target unless the user passes an explicit force option

#### Scenario: Warning visibility
- **WHEN** hook, agent, or skill conversion loses unsupported semantics
- **THEN** the manifest SHALL include a warning with source path, target tool, field or event name, and reason
