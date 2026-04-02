## Context

`ai-cli-orch-wrapper` currently ships `.claude/commands/` markdown files and `.claude/aco/lib/adapter.sh` directly inside the repo. Every slash command sources `adapter.sh` via a relative path, spawns `gemini` or `copilot` directly, and manages task output with ad-hoc bash tmpfiles. There is no versioned installation step, no provider abstraction, and no lifecycle ownership outside of individual shell scripts.

The goal is to refactor the repo into a publishable, installable command pack backed by a provider-aware Node.js wrapper runtime, while keeping the `/gemini:*` and `/copilot:*` command surface unchanged for end-users.

## Goals / Non-Goals

**Goals:**
- Introduce `packages/installer` (npx-installable CLI) that copies command templates and places the `aco` wrapper binary
- Introduce `packages/wrapper` (Node.js runtime) that owns provider dispatch, execution mode, session/task/output lifecycle
- Replace bash-direct provider spawning with wrapper invocation in all slash commands
- Define an extensible provider plugin interface (`GeminiProvider`, `CopilotProvider`)
- Separate `aco pack setup` (installs templates + wrapper) from `aco provider setup <name>` (authenticates CLI)
- Move all prompt templates to `templates/prompts/` so installer can copy them on demand

**Non-Goals:**
- Changing the visible command names (`/gemini:review`, `/copilot:rescue`, etc.)
- Supporting non-CLI AI providers (REST-only APIs) in v1
- GUI or web-based management of sessions
- Replacing the Node.js runtime with another language in this change

## Decisions

### D1: npm workspace monorepo (`packages/installer`, `packages/wrapper`)

**Choice**: pnpm/npm workspace under `packages/`.
**Rationale**: Installer and wrapper have separate publish lifecycles; a workspace lets them share types without a registry round-trip during development.
**Alternatives considered**:
- Single package: conflates install-time logic with runtime; harder to publish independently.
- Go binary: no clear advantage over Node.js given the ecosystem is already npm-based.

### D2: Wrapper invoked as a subprocess from slash command markdown

**Choice**: Slash command markdown shells out to `aco run <provider> <command> [args]`; wrapper takes over from there.
**Rationale**: Claude Code slash commands already execute shell commands; the wrapper becomes the single boundary between markdown and provider logic.
**Alternatives considered**:
- Wrapper as a Claude Code MCP server: more elegant but adds MCP setup complexity; out of scope.
- Keep bash adapter, wrap it in Node: still leaves bash as the orchestration layer.

### D3: Provider plugin as a TypeScript interface (`IProvider`)

**Choice**: Each provider is a class implementing `IProvider` with methods: `isAvailable()`, `checkAuth()`, `buildArgs(command, options)`, `invoke(prompt, options): AsyncIterable<string>`.
**Rationale**: Typed contract makes adding a third provider (e.g., `claude`, `openai`) a matter of adding one file, with no changes to core runtime.
**Alternatives considered**:
- JSON-configurable provider manifest: insufficient for providers with complex auth flows.
- Shell adapter per provider: replicates the current problem.

### D4: Task/session/output lifecycle in wrapper, not bash tmpfiles

**Choice**: Wrapper maintains a `~/.aco/sessions/<id>/` directory per session: `task.json` (status, provider, command, timestamps), `output.log` (streaming output), `error.log`.
**Rationale**: Normalised on-disk format enables `aco status`, `aco result`, `aco cancel` to work reliably across shells and restarts.
**Alternatives considered**:
- In-memory only: lost on process crash.
- SQLite: heavier dep with no meaningful advantage at this scale.

### D5: Template installation copies files, not symlinks

**Choice**: `aco pack install` copies `templates/commands/` → `~/.claude/commands/` (or project `.claude/commands/`).
**Rationale**: Symlinks to npm global dir break when node is upgraded; copies are stable and inspectable.
**Alternatives considered**:
- Symlinks: fragile across nvm/fnm version switches.
- Registry-pull at command time: adds network dependency to every invocation.

## Risks / Trade-offs

- **[Risk] Node.js version drift** → Mitigation: declare `engines.node` in `packages/wrapper/package.json`; installer validates at setup time.
- **[Risk] User has custom `.claude/commands/` edits** → Mitigation: `aco pack install --force` flag; default is to skip existing files and warn.
- **[Risk] `aco` binary name collision** → Mitigation: check `$PATH` for collision in installer; allow `--binary-name` override.
- **[Trade-off] Wrapper adds ~50-100ms startup latency per invocation** → Acceptable; provider CLIs themselves add 200-500ms. Session warm-up can be explored later.
- **[Risk] bash tests in `.claude/aco/tests/` become stale** → Mitigation: migrate tests to `packages/wrapper/tests/`; delete bash test files.

## Migration Plan

1. Create `packages/` workspace structure; confirm `npm install` works
2. Implement `packages/wrapper` with provider interface, session store, and `aco run` CLI entry
3. Implement `packages/installer` with `aco pack install` and `aco provider setup <name>`
4. Move `.claude/aco/prompts/` → `templates/prompts/`; move `.claude/commands/` → `templates/commands/`
5. Update all `templates/commands/**/*.md` to replace `source .../adapter.sh` + direct spawn with `aco run <provider> <command>`
6. Delete `.claude/aco/lib/adapter.sh` and `.claude/commands/` from repo
7. Update `package.json` to be workspace root; update `scripts.test` to point at wrapper tests
8. Update `README.md` install instructions

**Rollback**: The old `.claude/` files can be restored from git history. The wrapper binary can be uninstalled with `aco pack uninstall`.

## Open Questions

- Should `aco pack install` target `~/.claude/` (global) or `./.claude/` (project-local) by default? Proposal leans project-local with `--global` flag.
- Do we need a lockfile for installed pack version (analogous to `package-lock.json`) to support `aco pack update`?
- Should `aco cancel <session-id>` send SIGTERM to the provider subprocess, or just mark the task cancelled in `task.json`?
