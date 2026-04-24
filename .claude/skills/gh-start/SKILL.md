---
name: gh-start
description: Start a GitHub issue by moving it to In Progress and creating the branch/worktree. Use when Codex is invoked with $gh-start or when the user wants the Claude /gh-start experience in Codex.
---

# gh-start

Codex command-alias skill for Claude `/gh-start` parity.

This skill is a thin wrapper. Do not define start-work policy here. Load and follow the `Start Issue` workflow in `../github-kanban-ops/SKILL.md`.

Invocation examples:

- `$gh-start #69`
- `$gh-start 69`

Rules:

- Use `github-kanban-ops` as the canonical policy source.
- Move the issue Project item to `Status=In Progress`.
- Do not add status labels.
- Create the branch from latest `origin/main`.
- Create the Codex worktree under `.aco-worktrees/<prefix>-<N>`.
- Report the worktree path, branch name, issue URL, Project result, and warnings.
