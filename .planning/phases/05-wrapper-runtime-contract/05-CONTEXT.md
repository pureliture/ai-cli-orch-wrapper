# Phase 05: Wrapper Runtime Contract - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase ensures that the consolidated `aco` command works seamlessly with the existing repo-local runtime contract (`.wrapper.json` and `.wrapper/`). 

It focuses on rebranding the internal user experience (logs, comments, and code symbols) while preserving the stable file-naming contract for existing repositories. It also clarifies the priority of built-in subcommands and removes legacy references to the unused `wrapper.lock` file.

</domain>

<decisions>
## Implementation Decisions

### File Naming Strategy (WRAP-01, WRAP-02)
- **D-01:** **Filename Stability.** Do NOT rename `.wrapper.json` or `.wrapper/`. These remain the canonical repo-local contract for v1.1 to ensure compatibility with existing checkouts.
- **D-02:** **Branding Cutover.** Even though file names stay as `wrapper`, all user-facing logs, CLI output, and generated file headers must identify as `aco`.
  - Example: `# Managed by aco -- do not edit manually.`
  - Example: `✓ .wrapper.json: already exists`

### Internal Code Symbols
- **D-03:** **Symbol Rename.** Perform a full internal rename of TypeScript symbols from `Wrapper*` to `Aco*` (e.g., `WrapperConfig` -> `AcoConfig`, `WrapperCommand` -> `AcoCommand`). 
- **D-04:** **Mapping.** The internal `AcoConfig` loader will still target the `.wrapper.json` file on disk.

### Lockfile Removal
- **D-05:** **Remove .lock References.** `wrapper.lock` is out of scope for v1.1 and has no active implementation. Remove all remaining references to it from `ROADMAP.md`, `PROJECT.md`, and `REQUIREMENTS.md` to eliminate ambiguity.

### Subcommand Priority (CMD-03)
- **D-06:** **Error on Conflict.** The CLI must validate `.wrapper.json` aliases on startup. If an alias key matches a built-in `aco` subcommand (e.g., `setup`, `workflow`, `version`, `help`), the CLI must exit with a clear error message: `Error: alias 'setup' in .wrapper.json conflicts with a built-in command.`

### Claude's Discretion
- The exact wording of the conflict error message.
- The specific locations in logs/comments where `aco` branding is applied.
- The order of internal symbol refactoring.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — `CMD-03`, `WRAP-01`, `WRAP-02` are the core targets.

### Project Context
- `.planning/PROJECT.md` — Vision and constraints. Note: `wrapper.lock` references here are to be removed per D-05.
- `.planning/ROADMAP.md` — Phase 05 success criteria. Note: success criteria already align with D-01/D-02 but need `wrapper.lock` removal.

### Prior Phase Foundations
- `.planning/phases/04-canonical-command-surface/04-CONTEXT.md` — Established `aco` as the single public command.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/config/wrapper-config.ts` — The core config loader. To be renamed to `aco-config.ts` (internal symbol `AcoConfig`).
- `src/orchestration/artifacts.ts` — Defines `.wrapper/workflows` paths. Keep paths but rename internal symbols.
- `src/cli-surface.ts` — Centralized branding strings. Use for the `aco` branding cutover.

### Integration Points
- `aco setup` (`src/commands/setup.ts`) — Update to use `aco` branding in comments and logs.
- Alias resolution (`src/cli.ts`) — Add the conflict check (D-06).

</code_context>

<specifics>
## Specific Ideas

- "Rename internal symbols (WrapperConfig -> AcoConfig) but keep the file on disk as .wrapper.json."
- "Error if user defines 'setup' as an alias in .wrapper.json."

</specifics>

<deferred>
## Deferred Ideas

- Full filename rename (`.aco.json`, `.aco/`) — Defer to v1.2 or v2.0 when a breaking contract change is acceptable.
- `wrapper.lock` implementation — Defer to v1.3 (Isolated Workspaces) if needed for lock-in-place state.

</deferred>

---

*Phase: 05-wrapper-runtime-contract*
*Context gathered: 2026-03-31*
