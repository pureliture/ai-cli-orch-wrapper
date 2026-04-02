<!-- GSD:project-start source:PROJECT.md -->
## Project

**ai-cli-orch-wrapper**

어느 PC에서나 단일 명령어로 동일한 AI CLI 오케스트레이션 환경을 재현할 수 있는 개인용 래퍼 툴.
tmux + workmux 기반으로 Claude Code, Gemini CLI, Codex, Copilot CLI 등 여러 AI CLI를 같은 환경 규약 아래에서 다룰 수 있다.

**Core Value:** 어느 PC로 옮겨도 단일 명령어 하나로 동일한 AI CLI 오케스트레이션 환경이 즉시 복원되어야 한다.

### Constraints

- **전제 조건**: tmux, workmux는 이미 설치된 환경에서만 동작
- **tmux conf 비침습**: `~/.tmux.conf` 직접 수정 금지. `~/.config/tmux/ai-cli.conf`에만 작성하고 source 라인 한 줄만 추가
- **registry 결합 금지**: registry-hub URL은 설정값으로만 참조, 이 래퍼에 하드코딩 또는 의존 금지
- **이식성 우선**: 환경 상태는 이 레포 안에서 완전히 재현 가능해야 함
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.x - All source code in `src/`
- JavaScript (ES2022 modules) - Compiled output in `dist/`
## Runtime
- Node.js >=18.0.0 (required; active environment is v25.7.0)
- npm (inferred from `package-lock.json`)
- Lockfile: `package-lock.json` present (lockfileVersion 3)
## Frameworks
- None - pure Node.js standard library; no application framework
- Node.js built-in test runner (`node --test`) - invoked via `npm test`
- TypeScript compiler (`tsc`) - build via `npm run build`, watch via `npm run dev`
- `tsc --noEmit` - used as linter via `npm run lint`
## Key Dependencies
- None at runtime - zero production dependencies; all dependencies are devDependencies
- `typescript` ^5.0.0 - TypeScript compiler
- `@types/node` ^20.0.0 - Node.js type definitions
## Standard Library Usage
- `node:fs` (`readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`) - file I/O in `src/registry/lockfile.ts` and `src/commands/download.ts`
- `node:path` (`join`, `basename`) - path manipulation in `src/commands/download.ts`
- `fetch` (global, available in Node >=18) - HTTP downloads in `src/commands/download.ts`
## Configuration
- `target`: ES2022
- `module`: NodeNext
- `moduleResolution`: NodeNext
- `strict`: true
- `outDir`: `./dist`
- `rootDir`: `./src`
- `declaration`: true, `declarationMap`: true, `sourceMap`: true
- `resolveJsonModule`: true
- No `.env` file present
- No environment variables required by current implementation
- `tsconfig.json` at project root
- Output goes to `dist/` (committed; not gitignored based on repo state)
## Platform Requirements
- Node.js >=18.0.0
- npm (any recent version supporting lockfileVersion 3)
- Node.js >=18.0.0
- Binary entrypoint: `dist/cli.js` (invoked as `wrapper` via `bin` field in `package.json`)
- Library entrypoint: `dist/index.js` (for programmatic use)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- kebab-case for all source files: `download.ts`, `lockfile.ts`, `types.ts`
- Commands live in `src/commands/`, registry types and logic in `src/registry/`
- Compiled output mirrors src structure under `dist/`
- camelCase for all functions: `downloadCommand`, `readLockFile`, `writeLockFile`, `addLockedItem`, `printHelp`
- Command handler functions are named `<name>Command` (e.g., `downloadCommand`)
- Pure utility functions are named by verb+noun: `readLockFile`, `writeLockFile`, `addLockedItem`
- camelCase: `lockFile`, `lockedItem`, `localPath`, `downloadDir`, `filename`
- Constants are UPPER_SNAKE_CASE: `LOCK_FILE_NAME`, `LOCK_VERSION`
- PascalCase for all interfaces: `LockedItem`, `LockFile`
- Interfaces only (no `type` aliases used in the codebase so far)
- No `I` prefix convention — bare noun names
## Code Style
- No Prettier or ESLint config present — formatting is manual/editor-enforced
- 2-space indentation (enforced by TypeScript compiler output)
- Single quotes for string literals
- Trailing commas in object literals
- `tsc --noEmit` serves as the lint command (configured in `package.json` as `npm run lint`)
- TypeScript `strict: true` is the primary quality gate
- No ESLint or Biome installed
## TypeScript Configuration
- Target: `ES2022`
- Module: `NodeNext` with `moduleResolution: NodeNext`
- `strict: true` — all strict checks enabled
- `declaration: true` and `declarationMap: true` — type declarations emitted for library use
- `sourceMap: true` — source maps emitted
- `resolveJsonModule: true`
- All imports use explicit `.js` extensions (required by NodeNext resolution): `import { ... } from './commands/download.js'`
## Import Organization
- None — all imports are relative paths
- Named imports preferred: `import { mkdirSync, writeFileSync } from 'node:fs'`
- `import type` used for type-only imports: `import type { LockedItem } from '../registry/types.js'`
## Error Handling
- `try/catch` blocks in async functions and in I/O functions
- Error discrimination with `instanceof Error` guard: `error instanceof Error ? error.message : String(error)`
- On unrecoverable errors: `console.error(...)` then `process.exit(1)`
- Graceful fallback in `readLockFile`: returns empty default object when file is missing or unparseable rather than throwing
- HTTP errors checked via `response.ok` and thrown as `new Error(...)` with descriptive message
## Logging
- `console.log(...)` for progress/success messages
- `console.error(...)` for error messages
- Template literals used for interpolation: `` console.log(`Downloading: ${url}...`) ``
- No structured logging, no log levels, no timestamps
## Comments
- File-level JSDoc blocks on every source file describing the module's purpose
- Inline comments for non-obvious logic (e.g., `// Remove existing entry for the same URL if it exists`)
- No function-level JSDoc on individual exports
- File-level blocks use two-line format: title line, blank line, description line
## Function Design
- Optional parameters use default values: `function readLockFile(path = LOCK_FILE_NAME)`
- Typed parameters always: `url: string`, `lockFile: LockFile`
- Explicit return types on all exported functions: `Promise<void>`, `LockFile`, `void`
- `async/await` for all async operations — no raw Promise chains
## Module Design
- Named exports only — no default exports
- `src/index.ts` re-exports everything via `export * from '...'` barrel pattern
- `src/index.ts` is the single barrel, re-exporting all public modules
- `src/cli.ts` is the binary entry point (not re-exported)
## Constants
- Module-level constants use UPPER_SNAKE_CASE
- Placed at top of file before function definitions
- Example: `const LOCK_FILE_NAME = 'wrapper.lock'`, `const LOCK_VERSION = '1.0.0'`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- The TypeScript `src/` code is a thin URL-downloader CLI with a lock-file tracking layer, currently acting as scaffolding for a future JSON-LD registry resolver.
- The dominant operational architecture lives in `.claude/`, `.codex/`, `.gemini/` as AI-agent orchestration configurations: slash-command definitions, named sub-agent specs, and CJS runtime libraries.
- A runtime state machine (`.omx/`) tracks orchestration sessions, plans, and notification state across AI invocations.
- The GSD system is portable: the same structure is mirrored across `.claude/`, `.codex/`, and `.gemini/` for Claude, Codex, and Gemini runtimes respectively.
## Layers
- Purpose: Parse argv, dispatch to command handlers, print help/version
- Location: `src/cli.ts`
- Contains: `main()` async dispatch function, `printHelp()`, hardcoded version string `v0.2.0`
- Depends on: `src/commands/download.ts`
- Used by: Built artifact `dist/cli.js` via `bin.wrapper` in `package.json`
- Purpose: Implement each CLI verb as an isolated async function
- Location: `src/commands/download.ts`
- Contains: `downloadCommand(url)` — fetches URL, saves to `.wrapper/downloads/`, updates lock file
- Depends on: Node `fs`, `path`, native `fetch`, `src/registry/lockfile.ts`, `src/registry/types.ts`
- Used by: `src/cli.ts`
- Purpose: Persist and mutate the list of downloaded items with deduplication by URL
- Location: `src/registry/lockfile.ts`, `src/registry/types.ts`
- Contains: `readLockFile()`, `writeLockFile()`, `addLockedItem()`, `LockFile` and `LockedItem` interfaces
- Depends on: Node `fs` only
- Used by: `src/commands/download.ts`, re-exported through `src/index.ts`
- Purpose: Expose all internals for programmatic consumption
- Location: `src/index.ts`
- Contains: Barrel re-exports of `registry/types`, `registry/lockfile`, `commands/download`
- Depends on: All other `src/` modules
- Used by: External consumers importing the package as a library
- Purpose: AI workflow engine — slash commands, named sub-agents, runtime CJS helpers
- Location: `.claude/commands/gsd/` (57 command definitions), `.claude/agents/` (18 agent specs), `.claude/get-shit-done/bin/` and `.claude/get-shit-done/bin/lib/` (runtime CJS modules)
- Contains: Markdown-defined slash commands, agent persona files, and CJS modules (`core.cjs`, `state.cjs`, `phase.cjs`, `milestone.cjs`, `roadmap.cjs`, `profile-pipeline.cjs`, `security.cjs`, `template.cjs`, `verify.cjs`, `workstream.cjs`, etc.)
- Depends on: Node.js CJS runtime, `.planning/` directory tree, `.omx/` state
- Used by: Claude Code at slash-command invocation time
- Purpose: Persist cross-session orchestration state — active session, plan files, daily logs, notification state
- Location: `.omx/state/`, `.omx/plans/`, `.omx/logs/`
- Contains: `session.json`, `hud-state.json`, `notify-*` state files, per-session subdirectories, JSONL event logs
- Depends on: Written by GSD bin scripts
- Used by: GSD hooks and status-line scripts
- Purpose: Human and agent readable project plan documents consumed by `/gsd:plan-phase` and `/gsd:execute-phase`
- Location: `.planning/` (root), `.planning/codebase/`
- Contains: Milestone/phase markdown files, codebase analysis documents (ARCHITECTURE.md, STACK.md, etc.)
- Depends on: Written by `gsd-codebase-mapper` agent, `gsd-planner` agent
- Used by: `gsd-executor`, `gsd-planner`, `gsd-verifier` agents
## Data Flow
- TypeScript layer: stateless functions; all state in `wrapper.lock` (JSON file on disk)
- GSD layer: state persisted in `.omx/state/session.json`, `.omx/state/hud-state.json`, JSONL event logs in `.omx/logs/`
## Key Abstractions
- Purpose: Represents one tracked download in the current lock file
- Examples: `src/registry/types.ts`
- Pattern: Plain TypeScript interface with `url`, `localPath`, `downloadedAt` fields. Future shape (per `docs/lockfile-example.json`) will add `identifier`, `registryType`, `catalogUrl`, `contentUrl`, `channel`, `status`, `lockedAt`
- Purpose: Root container for all locked items, versioned with `lockVersion`
- Examples: `src/registry/types.ts`, `docs/lockfile-example.json`
- Pattern: JSON-serializable object with `lockVersion: string` and `items: LockedItem[]`
- Purpose: Self-contained AI workflow step invoked by developer
- Examples: `.claude/commands/gsd/execute-phase.md`, `.claude/commands/gsd/plan-phase.md`, `.claude/commands/gsd/map-codebase.md`
- Pattern: Markdown file with structured prompt, role definition, process steps, and tool usage guidance
- Purpose: Named specialized AI persona spawned by orchestrating commands
- Examples: `.claude/agents/gsd-executor.md`, `.claude/agents/gsd-planner.md`, `.claude/agents/gsd-codebase-mapper.md`
- Pattern: Markdown role file read by Claude when spawning a sub-agent task
- Purpose: JSON-LD `DataCatalog` hub-and-leaf structure for discovering installable skills and ReproGate gates
- Examples: Documented in `docs/registry-resolver.md`, `docs/lockfile-example.json`
- Pattern: Hub `DataCatalog` → `hasPart[]` → leaf `DataCatalog` → `dataset[]` → `SoftwareSourceCode` items
## Entry Points
- Location: `src/cli.ts` (compiled to `dist/cli.js`)
- Triggers: `node dist/cli.js <command>` or via `wrapper` bin alias after `npm install`
- Responsibilities: argv parsing, command dispatch, help/version output, top-level error handling with `process.exit(1)`
- Location: `src/index.ts` (compiled to `dist/index.js`)
- Triggers: `import { ... } from 'ai-cli-orch-wrapper'` by external consumers
- Responsibilities: Barrel export of all public types and functions
- Location: `.claude/commands/gsd/*.md`
- Triggers: Developer types `/gsd:<command>` in Claude Code chat
- Responsibilities: Loads command prompt, optionally spawns sub-agents, reads/writes `.planning/` and `.omx/` state
## Error Handling
- `src/cli.ts`: Top-level `main().catch()` prints error message and exits with code 1
- `src/commands/download.ts`: `try/catch` around fetch+write, prints error and exits with code 1 on failure
- `src/registry/lockfile.ts`: `readLockFile()` catches JSON parse errors and returns a clean empty `LockFile` rather than propagating — silent recovery pattern
- No custom error class hierarchy; errors are caught as `Error | unknown` and stringified
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
