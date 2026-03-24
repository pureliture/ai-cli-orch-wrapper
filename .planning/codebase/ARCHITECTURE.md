# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Dual-system repository — a small TypeScript CLI prototype layered beneath a large shell-orchestrated GSD (Get Shit Done) workflow engine.

**Key Characteristics:**
- The TypeScript `src/` code is a thin URL-downloader CLI with a lock-file tracking layer, currently acting as scaffolding for a future JSON-LD registry resolver.
- The dominant operational architecture lives in `.claude/`, `.codex/`, `.gemini/` as AI-agent orchestration configurations: slash-command definitions, named sub-agent specs, and CJS runtime libraries.
- A runtime state machine (`.omx/`) tracks orchestration sessions, plans, and notification state across AI invocations.
- The GSD system is portable: the same structure is mirrored across `.claude/`, `.codex/`, and `.gemini/` for Claude, Codex, and Gemini runtimes respectively.

## Layers

**CLI Entry Point:**
- Purpose: Parse argv, dispatch to command handlers, print help/version
- Location: `src/cli.ts`
- Contains: `main()` async dispatch function, `printHelp()`, hardcoded version string `v0.2.0`
- Depends on: `src/commands/download.ts`
- Used by: Built artifact `dist/cli.js` via `bin.wrapper` in `package.json`

**Command Handlers:**
- Purpose: Implement each CLI verb as an isolated async function
- Location: `src/commands/download.ts`
- Contains: `downloadCommand(url)` — fetches URL, saves to `.wrapper/downloads/`, updates lock file
- Depends on: Node `fs`, `path`, native `fetch`, `src/registry/lockfile.ts`, `src/registry/types.ts`
- Used by: `src/cli.ts`

**Registry / Lock-file Layer:**
- Purpose: Persist and mutate the list of downloaded items with deduplication by URL
- Location: `src/registry/lockfile.ts`, `src/registry/types.ts`
- Contains: `readLockFile()`, `writeLockFile()`, `addLockedItem()`, `LockFile` and `LockedItem` interfaces
- Depends on: Node `fs` only
- Used by: `src/commands/download.ts`, re-exported through `src/index.ts`

**Library Surface:**
- Purpose: Expose all internals for programmatic consumption
- Location: `src/index.ts`
- Contains: Barrel re-exports of `registry/types`, `registry/lockfile`, `commands/download`
- Depends on: All other `src/` modules
- Used by: External consumers importing the package as a library

**GSD Orchestration Layer (Claude runtime):**
- Purpose: AI workflow engine — slash commands, named sub-agents, runtime CJS helpers
- Location: `.claude/commands/gsd/` (57 command definitions), `.claude/agents/` (18 agent specs), `.claude/get-shit-done/bin/` and `.claude/get-shit-done/bin/lib/` (runtime CJS modules)
- Contains: Markdown-defined slash commands, agent persona files, and CJS modules (`core.cjs`, `state.cjs`, `phase.cjs`, `milestone.cjs`, `roadmap.cjs`, `profile-pipeline.cjs`, `security.cjs`, `template.cjs`, `verify.cjs`, `workstream.cjs`, etc.)
- Depends on: Node.js CJS runtime, `.planning/` directory tree, `.omx/` state
- Used by: Claude Code at slash-command invocation time

**GSD Runtime State (`omx`):**
- Purpose: Persist cross-session orchestration state — active session, plan files, daily logs, notification state
- Location: `.omx/state/`, `.omx/plans/`, `.omx/logs/`
- Contains: `session.json`, `hud-state.json`, `notify-*` state files, per-session subdirectories, JSONL event logs
- Depends on: Written by GSD bin scripts
- Used by: GSD hooks and status-line scripts

**Planning Artifacts:**
- Purpose: Human and agent readable project plan documents consumed by `/gsd:plan-phase` and `/gsd:execute-phase`
- Location: `.planning/` (root), `.planning/codebase/`
- Contains: Milestone/phase markdown files, codebase analysis documents (ARCHITECTURE.md, STACK.md, etc.)
- Depends on: Written by `gsd-codebase-mapper` agent, `gsd-planner` agent
- Used by: `gsd-executor`, `gsd-planner`, `gsd-verifier` agents

## Data Flow

**Download Command Flow:**

1. User runs `node dist/cli.js download <url>`
2. `src/cli.ts` parses `process.argv`, extracts URL, calls `downloadCommand(url)`
3. `src/commands/download.ts` issues native `fetch(url)`, reads response text
4. File is written to `.wrapper/downloads/<filename>` via `fs.writeFileSync`
5. `readLockFile()` loads `wrapper.lock` (or returns empty default if absent)
6. `addLockedItem()` deduplicates by URL and appends new `LockedItem`
7. `writeLockFile()` serializes updated `LockFile` JSON back to `wrapper.lock`

**GSD Command Dispatch Flow:**

1. Developer types `/gsd:<command>` in Claude Code
2. Claude reads the matching `.claude/commands/gsd/<command>.md` prompt file
3. Command prompt may spawn named sub-agents from `.claude/agents/gsd-*.md`
4. Sub-agents use CJS runtime tools from `.claude/get-shit-done/bin/lib/` via hooks
5. Artifacts are written to `.planning/` and state is persisted to `.omx/state/`
6. Hooks in `.claude/hooks/` provide pre/post tool-use context injection

**Intended Future Registry Resolution Flow (not yet implemented):**

1. Fetch `registry-hub/registry-catalog.jsonld` from SkillInterop GitHub
2. Read `hasPart[]` entries to discover leaf catalog URLs
3. Fetch each leaf `index.jsonld`
4. Normalize `dataset[]` items into unified in-memory index
5. Resolve relative `url` fields to absolute raw GitHub content URLs
6. Apply `registryType`, `channel`, `status` filters
7. Drive search / install / lock workflows writing to `wrapper.lock`

**State Management:**
- TypeScript layer: stateless functions; all state in `wrapper.lock` (JSON file on disk)
- GSD layer: state persisted in `.omx/state/session.json`, `.omx/state/hud-state.json`, JSONL event logs in `.omx/logs/`

## Key Abstractions

**LockedItem:**
- Purpose: Represents one tracked download in the current lock file
- Examples: `src/registry/types.ts`
- Pattern: Plain TypeScript interface with `url`, `localPath`, `downloadedAt` fields. Future shape (per `docs/lockfile-example.json`) will add `identifier`, `registryType`, `catalogUrl`, `contentUrl`, `channel`, `status`, `lockedAt`

**LockFile:**
- Purpose: Root container for all locked items, versioned with `lockVersion`
- Examples: `src/registry/types.ts`, `docs/lockfile-example.json`
- Pattern: JSON-serializable object with `lockVersion: string` and `items: LockedItem[]`

**GSD Slash Command:**
- Purpose: Self-contained AI workflow step invoked by developer
- Examples: `.claude/commands/gsd/execute-phase.md`, `.claude/commands/gsd/plan-phase.md`, `.claude/commands/gsd/map-codebase.md`
- Pattern: Markdown file with structured prompt, role definition, process steps, and tool usage guidance

**GSD Sub-Agent:**
- Purpose: Named specialized AI persona spawned by orchestrating commands
- Examples: `.claude/agents/gsd-executor.md`, `.claude/agents/gsd-planner.md`, `.claude/agents/gsd-codebase-mapper.md`
- Pattern: Markdown role file read by Claude when spawning a sub-agent task

**SkillInterop Registry Catalog (upstream, not yet consumed):**
- Purpose: JSON-LD `DataCatalog` hub-and-leaf structure for discovering installable skills, CAO profiles, and ReproGate gates
- Examples: Documented in `docs/registry-resolver.md`, `docs/lockfile-example.json`
- Pattern: Hub `DataCatalog` → `hasPart[]` → leaf `DataCatalog` → `dataset[]` → `SoftwareSourceCode` items

## Entry Points

**CLI Binary:**
- Location: `src/cli.ts` (compiled to `dist/cli.js`)
- Triggers: `node dist/cli.js <command>` or via `wrapper` bin alias after `npm install`
- Responsibilities: argv parsing, command dispatch, help/version output, top-level error handling with `process.exit(1)`

**Library Entry:**
- Location: `src/index.ts` (compiled to `dist/index.js`)
- Triggers: `import { ... } from 'ai-cli-orch-wrapper'` by external consumers
- Responsibilities: Barrel export of all public types and functions

**GSD Workflow Entry:**
- Location: `.claude/commands/gsd/*.md`
- Triggers: Developer types `/gsd:<command>` in Claude Code chat
- Responsibilities: Loads command prompt, optionally spawns sub-agents, reads/writes `.planning/` and `.omx/` state

## Error Handling

**Strategy:** Fail-fast with `process.exit(1)` at CLI boundary; silent fallback to empty defaults at the registry layer.

**Patterns:**
- `src/cli.ts`: Top-level `main().catch()` prints error message and exits with code 1
- `src/commands/download.ts`: `try/catch` around fetch+write, prints error and exits with code 1 on failure
- `src/registry/lockfile.ts`: `readLockFile()` catches JSON parse errors and returns a clean empty `LockFile` rather than propagating — silent recovery pattern
- No custom error class hierarchy; errors are caught as `Error | unknown` and stringified

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.error` only — no structured logging framework. GSD layer writes JSONL event logs to `.omx/logs/`.

**Validation:** No runtime schema validation on the lock file; `JSON.parse` cast directly to `LockFile`. Input validation is limited to checking that a URL argument is present.

**Authentication:** None in the TypeScript layer. No auth headers on `fetch` calls. GSD layer has a `security.cjs` module whose scope is limited to the orchestration runtime.

---

*Architecture analysis: 2026-03-24*
