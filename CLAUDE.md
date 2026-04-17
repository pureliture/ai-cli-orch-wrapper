# ai-cli-orch-wrapper

## Repo Structure

This repo is an npm workspace with the following layout:

- **`packages/wrapper/`** — `@pureliture/ai-cli-orch-wrapper`: Node.js wrapper runtime. Owns the `aco` CLI binary, provider interface (`IProvider`), provider implementations (`GeminiProvider`), provider registry, and session/task/output lifecycle (`SessionStore`). Exposes `aco pack install/setup`, `aco provider setup <name>`, and `aco run ...`.
- **`templates/commands/`** — Source for Claude Code slash command markdown files. Installed to `.claude/commands/` by `aco pack install`. Thin wrappers that delegate all logic to `aco run <provider> <command>`.
- **`templates/prompts/`** — Provider-specific prompt text. Installed to `.claude/aco/prompts/` by `aco pack install`.
- **`.claude/agents/`** — Agent definition files with frontmatter. Used by `aco delegate` for provider routing.
- **`openspec/`** — Architecture change proposals, specs, design docs, and task lists.

## Maintenance Rules

- Add shared provider logic only in `packages/wrapper/src/providers/`.
- Keep command template markdown files thin — no bash logic beyond arg parsing and `aco run` dispatch.
- Keep prompt text under `templates/prompts/`.
- New providers: implement `IProvider` in `packages/wrapper/src/providers/<name>.ts`, register in `registry.ts`.
- Run `npm test` (wrapper unit tests) before and after behavior changes.

## Key Design Decisions

- Provider spawning goes through `aco delegate` — the Go binary reads `.claude/agents/<id>.md` frontmatter to determine provider, no explicit provider argument needed.
- Session state lives in `~/.aco/sessions/<uuid>/` with `task.json` + `output.log`.
- Pack install copies files (not symlinks) to avoid path fragility across node version managers.
- `aco-install pack setup` and `aco-install provider setup <name>` are independent and composable.

## Go/Node.js Contract Boundary

Go 바이너리와 Node.js 래퍼 간의 책임 경계와 계약 관계는 [docs/contract/go-node-boundary.md](docs/contract/go-node-boundary.md)를 참고한다.

## Excluded on Purpose

- GSD/OMX workflows
- Codex/Gemini/GitHub mirror surfaces
- Planning and roadmap artifacts outside `openspec/`
