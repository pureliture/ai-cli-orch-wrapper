# ai-cli-orch-wrapper

## Repo Structure

This repo is an npm workspace with the following layout:

- **`packages/wrapper/`** — `@aco/wrapper`: Node.js wrapper runtime. Owns the `aco` CLI binary, provider interface (`IProvider`), provider implementations (`GeminiProvider`, `CopilotProvider`), provider registry, and session/task/output lifecycle (`SessionStore`).
- **`packages/installer/`** — `aco-install`: npm-publishable installer CLI. Provides `aco pack install/uninstall/status/setup` and `aco provider setup <name>`.
- **`templates/commands/`** — Source for Claude Code slash command markdown files. Installed to `.claude/commands/` by `aco pack install`. Thin wrappers that delegate all logic to `aco run <provider> <command>`.
- **`templates/prompts/`** — Provider-specific prompt text. Installed to `.claude/aco/prompts/` by `aco pack install`.
- **`openspec/`** — Architecture change proposals, specs, design docs, and task lists.

## Maintenance Rules

- Add shared provider logic only in `packages/wrapper/src/providers/`.
- Keep command template markdown files thin — no bash logic beyond arg parsing and `aco run` dispatch.
- Keep prompt text under `templates/prompts/`.
- New providers: implement `IProvider` in `packages/wrapper/src/providers/<name>.ts`, register in `registry.ts`.
- Run `npm test` (wrapper unit tests) before and after behavior changes.

## Key Design Decisions

- Provider spawning goes through `aco run` — no direct bash `gemini`/`copilot` invocations in templates.
- Session state lives in `~/.aco/sessions/<uuid>/` with `task.json` + `output.log`.
- Pack install copies files (not symlinks) to avoid path fragility across node version managers.
- `aco pack setup` and `aco provider setup <name>` are independent and composable.

## Excluded on Purpose

- GSD/OMX workflows
- Codex/Gemini/GitHub mirror surfaces
- Planning and roadmap artifacts outside `openspec/`
