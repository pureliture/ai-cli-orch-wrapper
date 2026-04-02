## 1. Repo & Workspace Setup

- [x] 1.1 Convert `package.json` to npm workspace root; add `packages/*` to `workspaces` field
- [x] 1.2 Create `packages/wrapper/` directory with `package.json`, `tsconfig.json`, and `src/` scaffold
- [x] 1.3 Create `packages/installer/` directory with `package.json` and `src/` scaffold
- [x] 1.4 Add `templates/commands/` and `templates/prompts/` directories to repo root
- [x] 1.5 Run `npm install` at workspace root and confirm no errors

## 2. Provider Interface & Registry

- [x] 2.1 Define `IProvider` TypeScript interface in `packages/wrapper/src/providers/interface.ts` with `isAvailable()`, `checkAuth()`, `buildArgs()`, `invoke()` methods
- [x] 2.2 Implement `GeminiProvider` in `packages/wrapper/src/providers/gemini.ts`
- [x] 2.3 Implement `CopilotProvider` in `packages/wrapper/src/providers/copilot.ts`
- [x] 2.4 Implement `ProviderRegistry` class in `packages/wrapper/src/providers/registry.ts` with `register()` and `get()` methods; pre-register Gemini and Copilot
- [x] 2.5 Write unit tests for `GeminiProvider.isAvailable()`, `CopilotProvider.isAvailable()`, and registry lookup

## 3. Session & Task Lifecycle

- [x] 3.1 Implement `SessionStore` in `packages/wrapper/src/session/store.ts` that creates/reads/updates `~/.aco/sessions/<id>/task.json` and `output.log`
- [x] 3.2 Implement session status transitions: `running` → `done` | `failed` | `cancelled`
- [x] 3.3 Implement streaming output tee: write to stdout and append to `output.log` simultaneously
- [x] 3.4 Write unit tests for `SessionStore` create, update, and read operations

## 4. Wrapper CLI Entry Point

- [x] 4.1 Implement `aco run <provider> <command> [options]` sub-command in `packages/wrapper/src/cli.ts`
- [x] 4.2 Implement `aco result [--session <id>]` sub-command
- [x] 4.3 Implement `aco status [--session <id>]` sub-command
- [x] 4.4 Implement `aco cancel [--session <id>]` sub-command (SIGTERM + session update)
- [x] 4.5 Add permission profile support (`--permission-profile default|restricted|unrestricted`) to `aco run`
- [x] 4.6 Wire up `bin` entry in `packages/wrapper/package.json` so `aco` resolves correctly after `npm link`

## 5. Installer CLI

- [x] 5.1 Implement `aco pack install [--global] [--force]` in `packages/installer/src/commands/pack-install.ts`: copy `templates/commands/` and `templates/prompts/` to target; link wrapper binary
- [x] 5.2 Implement `aco pack uninstall` to remove installed files and unlink binary
- [x] 5.3 Implement `aco pack status` to print pack version, installed file list, and per-provider availability/auth
- [x] 5.4 Implement `aco pack setup` as composite: `pack install` + per-provider availability report (no auth required)
- [x] 5.5 Implement `aco provider setup <name>` that calls `provider.isAvailable()` and `provider.checkAuth()`; prints install/auth hint on failure
- [x] 5.6 Add Node.js version check in installer entry point; exit non-zero if below `engines.node` range
- [x] 5.7 Add `bin` entry in `packages/installer/package.json`; publish as `aco-install` package name

## 6. Template Migration

- [x] 6.1 Copy `.claude/commands/gemini/*.md` → `templates/commands/gemini/` and `.claude/commands/copilot/*.md` → `templates/commands/copilot/`
- [x] 6.2 Copy `.claude/aco/prompts/` → `templates/prompts/`
- [x] 6.3 Update all `templates/commands/**/*.md` files: remove `source .../adapter.sh` lines; replace direct `gemini`/`copilot` spawn with `aco run <provider> <command>` invocation
- [x] 6.4 Verify each updated command template uses `aco run` and has no relative-path dependencies

## 7. Cleanup

- [x] 7.1 Delete `.claude/aco/lib/adapter.sh` from repo
- [x] 7.2 Delete `.claude/commands/` from repo (templates are now the source)
- [x] 7.3 Migrate bash tests from `.claude/aco/tests/` to `packages/wrapper/tests/` as appropriate; delete original bash test files
- [x] 7.4 Update `package.json` `scripts.test` to run wrapper package tests

## 8. Documentation

- [x] 8.1 Update `README.md` with new install instructions: `npx aco-install`, `aco pack setup`, `aco provider setup gemini`, `aco provider setup copilot`
- [x] 8.2 Add `CLAUDE.md` section explaining repo structure: `packages/`, `templates/`, `openspec/`
- [x] 8.3 Add `packages/wrapper/README.md` documenting `aco` CLI commands and provider extension guide
