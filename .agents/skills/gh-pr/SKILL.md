---
name: gh-pr
description: Create a GitHub Pull Request for tracked work using the GitHub Kanban operating model. Use when Codex is invoked with $gh-pr or when the user wants the Claude /gh-pr experience in Codex.
---

# gh-pr

Codex command-alias skill for Claude `/gh-pr` parity.

This skill is a thin wrapper. Do not define PR policy here. Load and follow the `Create Pull Request` workflow in `../github-kanban-ops/SKILL.md`.

Invocation examples:

- `$gh-pr #69`
- `$gh-pr create a PR closing #69`

Rules:

- Use `github-kanban-ops` as the canonical policy source.
- Derive the PR title from actual changes.
- Write PR body prose and checklist item descriptions in Korean by default.
- Keep `Closes #N`, labels, file paths, command names, and established Markdown headings in English.
- Add the PR to the active Project and move linked issues to `Status=In Review`.
- Copy only durable labels from linked issues to the PR.
- Report the PR URL, Project results, label sync result, and warnings.
