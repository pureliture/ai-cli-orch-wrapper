# Phase 1: Foundation + Environment Setup - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

`wrapper setup` command that bootstraps a complete AI CLI orchestration environment on any machine with a single command. Covers: prerequisite validation (cao, tmux, workmux), writing `~/.config/tmux/ai-cli.conf`, and injecting one `source-file` line into `~/.tmux.conf`. Also includes a complete rewrite of `src/` — the existing download PoC is removed.

Config file for CLI aliases (Phase 2) and inter-CLI orchestration (Phase 3) are out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### src/ Rewrite
- **D-01:** Delete `download.ts`, `lockfile.ts`, `types.ts`, `index.ts` entirely — all are unrelated download PoC code.
- **D-02:** Rewrite `cli.ts` from scratch. Phase 1 only exposes the `setup` command (plus `help` and `version`). No other commands.
- **D-03:** No library barrel export (`src/index.ts` removed) — this project is a CLI tool only.

### Prerequisite Check (SETUP-03)
- **D-04:** On startup of `wrapper setup`, check for `cao`, `tmux`, and `workmux` via PATH lookup (`command -v` equivalent).
- **D-05:** Error format: tool names only — `Error: missing prerequisites: cao, workmux`. No install URLs. Exit with non-zero code.
- **D-06:** All missing tools listed in a single error message (not one error per tool).

### tmux conf Bootstrap (SETUP-04)
- **D-07:** If `~/.tmux.conf` does not exist, auto-create it with only the `source-file` line. No error — fresh machine is a valid state (tmux being installed is already confirmed by prereq check).
- **D-08:** `~/.config/tmux/ai-cli.conf` is written with a comment header only in Phase 1. Phase 2 populates it with alias content.

  File content written by Phase 1:
  ```
  # ai-cli-orch-wrapper tmux config
  # Managed by wrapper setup — do not edit manually.
  # Phase 2 will populate CLI alias bindings here.
  ```

- **D-09:** Idempotency check: before injecting the `source-file` line, scan `~/.tmux.conf` for an existing line pointing to `~/.config/tmux/ai-cli.conf`. If found, skip injection.

### Output Format
- **D-10:** Both first run and re-run use the same `[✓]` checkmark summary format. No silent success.

  First run:
  ```
  [✓] prerequisites: cao, tmux, workmux found
  [✓] ~/.config/tmux/ai-cli.conf written
  [✓] ~/.tmux.conf: source line added
  Setup complete.
  ```

  Re-run (already configured):
  ```
  [✓] prerequisites: cao, tmux, workmux found
  [✓] ~/.config/tmux/ai-cli.conf: already exists
  [✓] ~/.tmux.conf: already configured
  Setup complete.
  ```

### Config File Scaffolding
- **D-11:** Phase 1 does NOT create a wrapper config file (for CLI alias/role mappings). That is Phase 2's responsibility.

### Claude's Discretion
- Exact mechanism for PATH lookup (Node.js `child_process.execSync('command -v cao')` vs `which` vs `spawnSync`) — Claude decides.
- Exact `source-file` line format (`source-file` vs `source` — use `source-file` for broader tmux version compatibility).
- `~/.config/tmux/` directory creation if it doesn't exist.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SETUP-01 through SETUP-04 define acceptance criteria for this phase. All four must pass.

### Project constraints
- `.planning/PROJECT.md` §Constraints — tmux conf non-invasive rule, registry coupling prohibition, portability-first principle.

No external specs — requirements are fully captured in decisions above and in REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tsconfig.json` — Keep as-is. ES2022 + NodeNext + strict is the right target for this CLI.
- `package.json` `bin.wrapper` → `dist/cli.js` — entrypoint already wired up correctly.
- `package.json` scripts (`build`, `lint`, `test`) — reuse unchanged.

### Established Patterns
- TypeScript strict mode, NodeNext modules, explicit `.js` extensions on imports — carry forward into rewritten code.
- `console.log` / `console.error` for output, `process.exit(1)` on error — established pattern to continue.
- Zero runtime dependencies — Phase 1 must stay dependency-free (Node.js built-ins only: `fs`, `path`, `child_process`).

### Integration Points
- `dist/cli.js` is the binary after `npm run build` — Phase 1 output lands here via `tsc`.
- Files to DELETE before rewriting: `src/commands/download.ts`, `src/registry/lockfile.ts`, `src/registry/types.ts`, `src/index.ts`.

</code_context>

<specifics>
## Specific Ideas

- Output style modeled after the preview shown during discussion:
  ```
  [✓] prerequisites: cao, tmux, workmux found
  [✓] ~/.config/tmux/ai-cli.conf written
  [✓] ~/.tmux.conf: source line added
  Setup complete.
  ```
- Error style: `Error: missing prerequisites: cao, workmux` (compact, no install hints)

</specifics>

<deferred>
## Deferred Ideas

- Wrapper config file (CLI alias/role mappings) — Phase 2
- Populating `ai-cli.conf` with actual tmux content — Phase 2
- `wrapper worktree` subcommands — Phase 2 / v2 scope

</deferred>

---

*Phase: 01-foundation-environment-setup*
*Context gathered: 2026-03-24*
