## MODIFIED Requirements

### Requirement: `aco sync` command
The system SHALL provide an `aco sync` command that explicitly synchronizes Claude Code project configuration into Codex structured-surface targets (custom agents, shared skills, hooks). It SHALL NOT generate or manage freeform project-guidance markdown such as `AGENTS.md` or `GEMINI.md`.

#### Scenario: Successful sync
- **WHEN** a user runs `aco sync` from the repository root
- **THEN** the system SHALL generate or update managed Codex structured-surface outputs (`.codex/agents/`, `.agents/skills/`, `.codex/hooks.json`, `.codex/config.toml`)
- **AND** write `.aco/sync-manifest.json`
- **AND** exit 0 when no fatal conflict occurs

#### Scenario: Sync from subdirectory
- **WHEN** a user runs `aco sync` from a subdirectory inside a Git repository
- **THEN** the system SHALL resolve the repository root
- **AND** read and write project-level files relative to that root

#### Scenario: No structured sources
- **WHEN** a repository has no structured sync source (`.claude/skills/` or `.claude/agents/`) — for example only `CLAUDE.md` and/or `.claude/rules/` — **AND** there is no prior sync manifest or legacy aco-owned target to reconcile
- **THEN** `aco sync` SHALL fail with a clear "No sync sources found" message instead of writing an empty manifest and exiting 0
- **AND** guideline sources (`CLAUDE.md`, `.claude/rules/`) alone SHALL NOT satisfy this requirement, because they no longer produce any synced output

#### Scenario: Cleanup-only sync without structured sources
- **WHEN** a repository has no structured source but a prior sync manifest or legacy aco-owned targets exist on disk
- **THEN** `aco sync` SHALL proceed (not hard-fail) so that stale-target removal and legacy Gemini cleanup can still complete


#### Scenario: Project-guidance markdown is out of scope
- **WHEN** `aco sync` runs
- **THEN** it SHALL NOT create or rewrite root `AGENTS.md` or `GEMINI.md`
- **AND** SHALL treat any existing `AGENTS.md` as a hand-maintained file

### Requirement: Sync check mode
The system SHALL provide `aco sync --check` to detect stale or missing generated structured-surface outputs without writing files. Hand-maintained files such as `AGENTS.md` SHALL NOT be evaluated for drift.

#### Scenario: Outputs are current
- **WHEN** all generated structured-surface outputs match the current Claude sources and manifest hashes
- **THEN** `aco sync --check` SHALL exit 0
- **AND** print that context sync is current

#### Scenario: Outputs are stale
- **WHEN** a Claude source file changed after the last manifest update
- **THEN** `aco sync --check` SHALL exit 1
- **AND** list the stale source and affected structured-surface targets

#### Scenario: Target drift
- **WHEN** a manifest-owned structured-surface target file was manually modified
- **THEN** `aco sync --check` SHALL exit 1
- **AND** report the target drift without rewriting the target

#### Scenario: Hand-maintained guidance edits do not fail check
- **WHEN** a user edits `AGENTS.md` (which has no managed block and is not a manifest target)
- **THEN** `aco sync --check` SHALL NOT report drift for `AGENTS.md`
