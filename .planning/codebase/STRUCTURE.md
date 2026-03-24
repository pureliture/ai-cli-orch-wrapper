# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
ai-cli-orch-wrapper/
├── src/                         # TypeScript source — CLI and library
│   ├── cli.ts                   # CLI entry point (bin: wrapper)
│   ├── index.ts                 # Library barrel exports
│   ├── commands/
│   │   └── download.ts          # download command handler
│   └── registry/
│       ├── types.ts             # LockFile / LockedItem interfaces
│       └── lockfile.ts          # read/write/mutate lock file
├── dist/                        # Compiled JS output (gitignored, generated)
│   ├── cli.js                   # Compiled CLI entry
│   ├── index.js                 # Compiled library entry
│   ├── commands/
│   │   └── download.js
│   └── registry/
│       ├── types.js
│       └── lockfile.js
├── docs/                        # Reference documentation and examples
│   ├── registry-resolver.md     # SkillInterop JSON-LD upstream structure notes
│   └── lockfile-example.json    # Proposed future consumer lock-file shape
├── .planning/                   # GSD project plan artifacts
│   └── codebase/                # Codebase analysis documents (written by gsd-codebase-mapper)
├── .claude/                     # Claude Code AI orchestration configuration
│   ├── commands/
│   │   └── gsd/                 # Slash command definitions (57 .md files)
│   ├── agents/                  # Named sub-agent persona definitions (18 .md files)
│   ├── hooks/                   # Pre/post tool-use hook scripts (.js)
│   └── get-shit-done/
│       ├── bin/
│       │   ├── lib/             # CJS runtime modules (core, state, phase, milestone, etc.)
│       │   └── gsd-tools.cjs    # Consolidated tool entry
│       ├── commands/gsd/        # Alternate command set (workflows)
│       ├── references/          # Reference docs for GSD patterns
│       ├── workflows/           # Named workflow markdown files
│       └── templates/
│           ├── codebase/        # Codebase doc templates (STACK.md, ARCHITECTURE.md, etc.)
│           └── research-project/
├── .codex/                      # Codex runtime mirror of .claude/ GSD system
│   ├── agents/
│   ├── get-shit-done/           # Identical structure to .claude/get-shit-done/
│   └── skills/                  # Codex skill definitions (one dir per GSD command)
├── .gemini/                     # Gemini runtime mirror of .claude/ GSD system
│   ├── agents/
│   ├── commands/gsd/
│   ├── hooks/
│   └── get-shit-done/
├── .omx/                        # Orchestration runtime state (written at runtime)
│   ├── state/
│   │   ├── session.json         # Active session metadata
│   │   ├── hud-state.json       # HUD display state
│   │   ├── notify-*.json        # Notification authority and hook state
│   │   ├── update-check.json    # Update check timestamps
│   │   └── sessions/            # Per-session subdirectories
│   ├── plans/                   # Plan files written by GSD planner
│   └── logs/                    # JSONL event logs (daily, by session)
├── .omc/                        # Additional orchestration state (session snapshots)
│   └── sessions/                # Snapshot files per session ID
├── package.json                 # npm manifest — name, bin, scripts, deps
├── package-lock.json            # npm lockfile
├── tsconfig.json                # TypeScript compiler config
├── README.md                    # Project overview, registry structure, usage
└── .gitignore                   # Ignores dist/, node_modules/, .wrapper/
```

## Directory Purposes

**`src/`:**
- Purpose: All TypeScript source code for the CLI and library
- Contains: Entry points, command handlers, registry types and utilities
- Key files: `src/cli.ts`, `src/index.ts`, `src/commands/download.ts`, `src/registry/lockfile.ts`, `src/registry/types.ts`

**`src/commands/`:**
- Purpose: One file per CLI verb; each exports a single async handler function
- Contains: `download.ts` — currently the only implemented command
- Key files: `src/commands/download.ts`

**`src/registry/`:**
- Purpose: Domain types and persistence helpers for the lock-file contract
- Contains: Interface definitions in `types.ts`, read/write/mutate functions in `lockfile.ts`
- Key files: `src/registry/types.ts`, `src/registry/lockfile.ts`

**`dist/`:**
- Purpose: TypeScript compiler output; mirrors `src/` structure with `.js`, `.d.ts`, `.map` files
- Generated: Yes — produced by `npm run build` (`tsc`)
- Committed: No (excluded by `.gitignore`)

**`docs/`:**
- Purpose: Human-readable reference material for the upstream SkillInterop registry structure and proposed lock-file shape
- Contains: `registry-resolver.md` (live JSON-LD topology notes), `lockfile-example.json` (proposed future lock-file schema)
- Key files: `docs/registry-resolver.md`, `docs/lockfile-example.json`

**`.planning/`:**
- Purpose: GSD project plan files — milestones, phases, codebase analysis docs
- Contains: Markdown phase/milestone files, `codebase/` subdirectory with mapper outputs
- Generated: Yes, by GSD commands (`/gsd:new-project`, `/gsd:map-codebase`, `/gsd:plan-phase`)
- Committed: Yes

**`.claude/commands/gsd/`:**
- Purpose: Slash command prompt definitions for Claude Code
- Contains: One `.md` file per GSD command (e.g., `execute-phase.md`, `plan-phase.md`, `map-codebase.md`)
- Key files: `.claude/commands/gsd/execute-phase.md`, `.claude/commands/gsd/plan-phase.md`

**`.claude/agents/`:**
- Purpose: Named sub-agent persona definitions spawned by orchestrating commands
- Contains: `.md` files for each specialist agent (executor, planner, codebase-mapper, verifier, debugger, etc.)
- Key files: `.claude/agents/gsd-executor.md`, `.claude/agents/gsd-planner.md`, `.claude/agents/gsd-codebase-mapper.md`

**`.claude/get-shit-done/bin/lib/`:**
- Purpose: CJS runtime modules providing shared logic for GSD hooks and tool scripts
- Contains: `core.cjs`, `state.cjs`, `phase.cjs`, `milestone.cjs`, `roadmap.cjs`, `profile-pipeline.cjs`, `security.cjs`, `template.cjs`, `verify.cjs`, `workstream.cjs`, `commands.cjs`, `config.cjs`, `frontmatter.cjs`, `init.cjs`, `model-profiles.cjs`, `uat.cjs`
- Key files: `.claude/get-shit-done/bin/lib/core.cjs` (path helpers, project root detection, sub-repo scanning)

**`.claude/hooks/`:**
- Purpose: Hook scripts executed before/after Claude tool invocations to inject context or enforce guards
- Contains: `.js` hook scripts (`gsd-context-monitor.js`, `gsd-prompt-guard.js`, `gsd-statusline.js`, `gsd-workflow-guard.js`, `gsd-check-update.js`)

**`.codex/` and `.gemini/`:**
- Purpose: Mirrors of the `.claude/` GSD system for Codex and Gemini runtimes respectively
- Contains: Identical command, agent, and `get-shit-done/` structures; `.codex/skills/` adds per-command skill directories
- Generated: No — maintained in sync with `.claude/`

**`.omx/`:**
- Purpose: Runtime-written orchestration state — session tracking, plan storage, event logs
- Contains: JSON state files, JSONL daily logs, per-session plan subdirectories
- Generated: Yes, at runtime
- Committed: No (per `.gitignore`)

## Key File Locations

**Entry Points:**
- `src/cli.ts`: CLI entry point compiled to `dist/cli.js`, invoked as `wrapper` binary
- `src/index.ts`: Library barrel entry compiled to `dist/index.js`

**Configuration:**
- `package.json`: npm manifest with `bin`, `scripts`, `engines`, `devDependencies`
- `tsconfig.json`: TypeScript config — `target: ES2022`, `module: NodeNext`, `outDir: dist`, `rootDir: src`

**Core Logic:**
- `src/registry/lockfile.ts`: Lock-file read/write/mutate — the only stateful logic in the TypeScript layer
- `src/registry/types.ts`: Canonical TypeScript interfaces for `LockFile` and `LockedItem`
- `src/commands/download.ts`: The only implemented command handler

**GSD Runtime Core:**
- `.claude/get-shit-done/bin/lib/core.cjs`: Shared path helpers and project root detection
- `.claude/get-shit-done/bin/lib/state.cjs`: Session/workspace state management
- `.claude/get-shit-done/bin/lib/phase.cjs`: Phase CRUD operations
- `.claude/get-shit-done/bin/lib/milestone.cjs`: Milestone management

**Reference Documents:**
- `docs/registry-resolver.md`: Live SkillInterop JSON-LD topology — source of truth for future implementation
- `docs/lockfile-example.json`: Proposed future lock-file shape with `identifier`, `registryType`, `catalogUrl`, `contentUrl`
- `README.md`: Project overview, upstream registry structure, known limitations

**Testing:**
- No test files exist in `src/`. `package.json` defines `"test": "node --test"` pointing at Node's built-in test runner, but no test files are present.

## Naming Conventions

**Files:**
- TypeScript source: `kebab-case.ts` (e.g., `download.ts`, `lockfile.ts`, `types.ts`)
- Compiled output: mirrors source names with `.js` extension
- GSD commands: `kebab-case.md` matching the command name after `gsd:` (e.g., `execute-phase.md`)
- GSD agents: `gsd-<role>.md` prefixed with `gsd-` (e.g., `gsd-executor.md`, `gsd-planner.md`)
- GSD lib modules: `<module>.cjs` (e.g., `core.cjs`, `state.cjs`)

**Directories:**
- `src/` subdirectories: `kebab-case` grouped by domain (`commands/`, `registry/`)
- GSD skill directories under `.codex/skills/`: `gsd-<command-name>` (e.g., `gsd-execute-phase/`)

**Exports:**
- Library exports use named exports only; barrel re-exported from `src/index.ts`
- No default exports in the TypeScript source

## Where to Add New Code

**New CLI Command (e.g., `search`):**
- Implement handler: `src/commands/search.ts` — export `async function searchCommand(...)`
- Register in CLI: `src/cli.ts` — add `else if (command === 'search')` branch
- Export from library: `src/index.ts` — add `export * from './commands/search.js'`
- Tests: Create `src/commands/search.test.ts` using Node built-in test runner

**New Registry Type or Interface:**
- Add to: `src/registry/types.ts`
- Follow existing pattern: plain TypeScript `interface`, no class, no methods

**New Lock-file Utility:**
- Add to: `src/registry/lockfile.ts` — export named function
- Re-export will be picked up automatically via `src/index.ts` barrel

**New GSD Command:**
- Command prompt: `.claude/commands/gsd/<command-name>.md`
- Mirror to: `.gemini/commands/gsd/<command-name>.md` and `.codex/skills/gsd-<command-name>/`
- If sub-agent needed: `.claude/agents/gsd-<agent-name>.md`

**New Planning Document:**
- Place in: `.planning/codebase/` for codebase analysis, `.planning/` root for milestone/phase files

## Special Directories

**`.wrapper/downloads/`:**
- Purpose: Runtime download destination written by `downloadCommand`
- Generated: Yes, created on first `wrapper download` invocation via `mkdirSync(..., { recursive: true })`
- Committed: No (excluded by `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependency installation
- Generated: Yes
- Committed: No

**`dist/`:**
- Purpose: TypeScript compiler output
- Generated: Yes — `npm run build`
- Committed: No

---

*Structure analysis: 2026-03-24*
