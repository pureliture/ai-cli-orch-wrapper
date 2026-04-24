---
name: gh-pr-followup
description: Triage unresolved GitHub PR review threads into immediate fixes or deferred follow-up issues. Use when Codex is invoked with $gh-pr-followup or when the user wants the Claude /gh-pr-followup experience in Codex.
---

# gh-pr-followup

Codex command-alias skill for Claude `/gh-pr-followup` parity.

This skill is a thin wrapper. Do not define review-follow-up policy here. Load and follow the `Handle Review Follow-up` workflow in `../github-kanban-ops/SKILL.md`.

Invocation examples:

- `$gh-pr-followup #70`
- `$gh-pr-followup triage unresolved review threads on PR #70`

Rules:

- Use `github-kanban-ops` as the canonical policy source.
- Classify unresolved review threads as immediate fixes, deferred issues, or user decisions.
- Create deferred issues only as `task`, `bug`, or `chore`.
- Add deferred issues to the active Project with `Status=Backlog`.
- Set assessed Project `Priority` only when confidence is sufficient.
- Report resolved threads, deferred issue URLs, Project results, review replies, and warnings.
