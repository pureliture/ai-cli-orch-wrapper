---
name: gh-issue
description: Create a GitHub issue in this repository using the GitHub Kanban operating model. Use when Codex is invoked with $gh-issue or when the user wants the Claude /gh-issue experience in Codex.
---

# gh-issue

Codex command-alias skill for Claude `/gh-issue` parity.

This skill is a thin wrapper. Do not define issue policy here. Load and follow the `Create Issue` workflow in `../github-kanban-ops/SKILL.md`.

Invocation examples:

- `$gh-issue task: migrate the PM harness to Codex`
- `$gh-issue bug: fix Project status sync failure`

Rules:

- Use `github-kanban-ops` as the canonical policy source.
- Create only `epic`, `task`, `bug`, or `chore` issues.
- Keep Project `Status` and `Priority` in GitHub Projects.
- Keep labels limited to durable classification.
- Report the issue URL, Project status result, Priority result, and warnings.
