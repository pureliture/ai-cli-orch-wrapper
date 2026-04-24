# ai-cli-orch-wrapper

Codex project instructions for this repository. Claude Code receives the matching
repo-level instructions from `CLAUDE.md`.

## Repo Structure

This repo is an npm workspace with the following layout:

- `packages/wrapper/` — `@pureliture/ai-cli-orch-wrapper` runtime. Owns the `aco` CLI, provider interface, provider implementations, provider registry, sync engine, and session/task/output lifecycle.
- `packages/installer/` — installer package for setup flows and install-time entrypoints used by `aco-install`.
- `templates/commands/` — packaged Claude slash command sources. Keep each file in parity with the matching `.claude/commands/` file when behavior changes.
- `.claude/commands/` — repo-local Claude slash commands used by maintainers.
- `.claude/skills/` — Claude-local skill sources and compatibility copies.
- `.agents/skills/` — shared Codex/Gemini skill surface. `github-kanban-ops` is the canonical GitHub PM policy source; `gh-*` skills are thin Codex command aliases.
- `.codex/agents/` — Codex custom agent definitions generated or maintained for local workflows.
- `.gemini/commands/` and `.gemini/agents/` — Gemini command and agent surfaces that should stay aligned with the active workflow where supported.
- `docs/` — architecture, contracts, guides, reference docs, phase plans, and archived planning material.
- `openspec/` — OpenSpec proposals, specs, design docs, and task lists.

## Maintenance Rules

- Preserve provider-neutral behavior in `packages/wrapper/src/`; add provider-specific code only behind the provider abstraction.
- New providers implement `IProvider` in `packages/wrapper/src/providers/<name>.ts` and register in `registry.ts`.
- Keep `.claude/commands/gh-*.md` and `templates/commands/gh-*.md` byte-for-byte aligned unless an intentional compatibility exception is documented.
- Keep `.agents/skills/github-kanban-ops/` and `.claude/skills/github-kanban-ops/` aligned when changing shared GitHub PM policy or scripts.
- Keep Codex `$gh-*` wrapper skills intentionally thin; workflow policy belongs in `github-kanban-ops`.
- Do not reintroduce sprint, story, or spike concepts into the GitHub PM harness.
- Do not encode workflow state or priority in labels. GitHub Project `Status` and `Priority` fields are the source of truth.
- Before finishing behavior changes, run the most specific validation available, then broader tests if practical.

## GitHub Kanban Workflow

Use `github-kanban-ops` as the canonical model for repository PM automation.

- Allowed issue types: `epic`, `task`, `bug`, `chore`.
- Durable labels only: `type:*`, `area:*`, `origin:review`.
- Forbidden labels/concepts: `status:*`, `sprint:*`, `p0`/`p1`/`p2`, `size:*`, `type:feature`, `type:story`, `type:spike`.
- Claude entrypoints: `/gh-issue`, `/gh-start`, `/gh-pr`, `/gh-pr-followup`.
- Codex entrypoints: `$gh-issue`, `$gh-start`, `$gh-pr`, `$gh-pr-followup`.
- `$github-kanban-ops` is for direct policy/workflow reference, not the normal command-like UX.
- PR body prose and checklist item descriptions are Korean by default; keep `Closes #N`, headings, labels, file paths, and command names in English.

## Codex-Specific Guidance

- Use the local `.agents/skills/*/SKILL.md` files when a task names a skill or clearly matches one.
- For GitHub PM tasks, prefer `$gh-*` wrapper skills for command-like UX and `github-kanban-ops` for policy details.
- Do not create `.codex/skills/` copies unless Codex runtime or packaging proves they are required.
- Treat `AGENTS.md` as the root instruction surface for Codex, but keep durable workflow policy in skills and docs.

## Worktree Policy

All write tasks must be performed in a dedicated Git worktree and task branch.

This is a mandatory rule. If the current directory is the main/local checkout, do not modify files. First create or switch to a dedicated task worktree.

Rules:

- Do not modify the main/local checkout for implementation work.
- Use a dedicated branch per task: `codex/{ticket-id}-{short-title}`.
- Keep each task isolated to its own worktree.
- Do not reuse the same branch across multiple worktrees.
- Read-only investigation may run in the local checkout.
- Dependency or lockfile changes require explicit review before merge.
- When finished, report:
  - worktree path
  - branch name
  - changed files
  - test commands and results
  - PR URL if created

## Context Sync

`aco sync` converts Claude project context into Codex/Gemini target surfaces.

- Source order starts with root `CLAUDE.md`, then optional `.claude/CLAUDE.md`, `.claude/rules/*.md`, skills, agents, and hooks.
- Codex project instructions live in root `AGENTS.md`.
- Gemini project instructions live in root `GEMINI.md`.
- Shared skills live in `.agents/skills/<skill>/`; do not hand-maintain `.codex/skills/` or `.gemini/skills/` copies unless the runtime requirement is proven.
- Use `aco sync --check` to detect stale generated targets and `aco sync --force` only when overwriting managed drift is intentional.

## Commit Message Policy

Use the repository commit template at `.gitmessage` and the Korean commit-writing prompt at `docs/guides/commit-message-prompt.md` whenever an AI assistant drafts or creates commits.

- Commit messages must use a title plus body format.
- The title must follow conventional commit style such as `fix(tests): replace echo pipeline with herestrings`.
- The body must explain the why, what changed, and affected files or areas in Korean by default.
- When Codex creates a commit, it must follow `docs/guides/commit-message-prompt.md`.
- Commit messages must include contributor trailers for every AI CLI and model used in development so GitHub Contributors can show the CLI/model identities where GitHub recognizes them.
- If a CLI or model has no GitHub-recognized identity, still include explicit `AI-CLI:` and `AI-Model:` trailers in addition to any available `Co-authored-by:` trailers.

## Validation

Common checks:

```bash
npm test
npm run typecheck
npm run test:fixtures
npm run test:smoke
git diff --check
```

Targeted harness checks:

```bash
cmp .claude/commands/gh-pr.md templates/commands/gh-pr.md
cmp .agents/skills/github-kanban-ops/scripts/make_issue_body.py .claude/skills/github-kanban-ops/scripts/make_issue_body.py
bash -n scripts/pm-hook.sh scripts/setup-github-labels.sh scripts/setup-github-project.sh scripts/setup-project-ids.sh
```

## Key References

- `docs/architecture.md` — system architecture and context sync overview.
- `docs/contract/go-node-boundary.md` — Go/Node.js responsibility boundary.
- `docs/reference/context-sync.md` — sync target surfaces and managed block behavior.
- `docs/reference/project-board.md` — GitHub Project field and option contract.
- `docs/guides/github-workflow.md` — issue/PR authoring and Kanban workflow guide.

## Excluded on Purpose

- GSD/OMX workflows.
- New sprint-based planning surfaces.
- Extra GitHub label taxonomies that duplicate Project fields.
