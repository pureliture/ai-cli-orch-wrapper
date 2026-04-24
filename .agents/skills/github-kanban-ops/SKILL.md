---
name: github-kanban-ops
description: Manage this repository with GitHub Projects, Issues, and Pull Requests in a minimal Kanban operating model. Use when Codex needs to create or triage epics, tasks, bugs, chores, PRs, review follow-ups, or project board hygiene.
---

# GitHub Kanban Ops

Treat GitHub Projects as the board, GitHub Issues as work items, and GitHub Pull Requests as delivery records. This skill is the canonical policy source for the repository's GitHub Kanban workflows. Claude `/gh-*` slash commands and Codex `$gh-*` skill wrappers remain thin compatibility interfaces that delegate to the workflows below.

## Quick Start

1. Inspect the current repository state before making changes.
2. Reuse the active repository GitHub Project and its existing fields.
3. Use the reference model in [references/github-kanban-model.md](./references/github-kanban-model.md) where local conventions are unclear.
4. Keep Projects as the source of truth for workflow state and priority.
5. Keep labels limited to stable classification that is useful outside the board.

## Context Build

Check these surfaces first:

- Repository labels
- Open issues and recent closed issues
- Active repository GitHub Project fields and views
- Existing issue templates or contributing docs
- Existing hierarchy conventions such as parent issues, sub-issues, tasklists, or cross-links

Prefer GitHub MCP tools when available. If they are not available, use `gh` CLI. Do not assume field or option IDs until you inspect the project or read the repository's project reference docs.

## Default Operating Model

Use the model in [references/github-kanban-model.md](./references/github-kanban-model.md).

Default mapping:

- Project `Status` holds workflow state.
- Project `Priority` holds priority when the field exists.
- Labels hold durable classification: `type:*`, `area:*`, `origin:review`.
- Milestones hold releases, phases, or externally meaningful delivery targets.
- Epic hierarchy lives in native parent/sub-issues first, with issue body links as fallback.

Do not duplicate workflow status or priority into labels. Avoid `status:*`, `sprint:*`, `p0`/`p1`/`p2`, `size:*`, `type:feature`, `type:story`, and `type:spike` labels.

## Project Configuration

Resolve Project configuration in this order:

1. Use environment variables when present.
2. Fall back to the repository defaults in `docs/reference/project-board.md`.
3. If a Project mutation fails, warn clearly and do not delete already-created issues or PRs as cleanup.

Use the active repository Project fields exactly as documented:

- `Status`: `Backlog`, `Ready`, `In Progress`, `In Review`, `Done`
- `Priority`: `P0`, `P1`, `P2`

When setting Project items, retry item lookup up to 5 times because GitHub Projects indexing can lag.

## Issue Model

Allowed issue types:

- `epic`: multi-issue outcome
- `task`: bounded implementation, improvement, investigation, or product work
- `bug`: broken behavior or regression
- `chore`: maintenance, cleanup, dependency, or operational work

Issue title format:

- `epic: <summary>`
- `task: <summary>`
- `bug: <summary>`
- `chore: <summary>`

Rules:

- The title prefix and `type:*` label must agree.
- Do not encode status, priority, size, sprint, or area in the title.
- Every issue must be added to the active repository GitHub Project when possible.
- New issues default to `Status=Backlog`.
- Priority is assessed from user intent and issue context when the Project `Priority` field exists; leave it unset with a triage warning when confidence is too low.
- Use `area:*` labels when the affected area is clear.
- Use `origin:review` only for work created from PR review feedback.
- Do not use feature, story, sprint, or spike as issue types.
- Do not add `status:*`, `sprint:*`, `p0`/`p1`/`p2`, `size:*`, `type:feature`, `type:story`, or `type:spike` labels.

## Pull Request Model

PR title format:

- `feat(scope): <summary>`
- `fix(scope): <summary>`
- `chore(scope): <summary>`
- `docs(scope): <summary>`

PR rules:

- Include `Closes #N`, `Fixes #N`, or `Resolves #N` for linked issues.
- Add PRs to the active repository GitHub Project when possible.
- Set the PR item `Status` to `In Review` when possible.
- Move linked issue items to `In Review` when possible.
- Copy only durable classification labels to PRs: `type:*`, `area:*`, `origin:review`.
- Do not copy `status:*`, `sprint:*`, `p0`/`p1`/`p2`, `size:*`, `type:feature`, `type:story`, `type:spike`, or other non-durable labels to PRs.

## Mutation Policy

Live GitHub mutations require clear user intent. Do not create issues, create PRs, edit Project items, reply to review threads, or resolve review threads unless the user has explicitly asked for that action in the current task.

When a live mutation runs, report:

- Created or updated issue/PR URLs
- Project item status and priority results
- Label sync results
- Parent/sub-issue linkage results
- Any warnings or manual follow-ups

## Execution Patterns

### Create Issue

Codex equivalent of Claude `/gh-issue`.

Use this workflow when the user asks Codex to create an `epic`, `task`, `bug`, or `chore` issue.

1. Confirm the user clearly intends to create a GitHub issue. If intent is unclear, draft the issue only.
2. Gather missing inputs: allowed issue type, summary, outcome, scope, acceptance criteria or definition of done, area label, review origin, parent epic, and priority context.
3. Enforce title format `<type>: <summary>` and required label `type:<type>`.
4. Keep optional labels limited to `area:*` and `origin:review`.
5. Generate the issue title/body with `.agents/skills/github-kanban-ops/scripts/make_issue_body.py` and pass substantive arguments so no generator defaults or placeholder prose remain.
6. Quality-check the generated body for concrete outcome, scope, acceptance criteria or definition of done, bug details when applicable, and parent context when provided.
7. Resolve Project configuration env-first, then from `docs/reference/project-board.md`.
8. Create the issue with `gh issue create --body-file` or the available GitHub connector.
9. Add the issue to the active Project, set `Status=Backlog`, and set the assessed `Priority` field when confidence is sufficient.
10. If priority confidence is too low, leave `Priority` unset and report `Priority unset — triage needed`.
11. Link the issue to its parent epic best-effort using native sub-issues first, child body `Parent` fallback, and parent epic checklist update when practical.
12. Report the issue URL, issue number, Project status result, Priority result, parent linkage result, and any warnings.

Use concise issue titles. Put acceptance criteria, scope boundaries, and operational constraints in the body, not in labels.

When creating a child work item for an epic, perform all available links:

- Add the issue as a GitHub native sub-issue of the parent epic when supported.
- Add a `Parent` section to the child issue body.
- Add `- [ ] #N` to the parent epic `Child Issues` checklist when practical.

### Start Issue

Codex equivalent of Claude `/gh-start`.

Use this workflow when the user asks Codex to start issue `#N`.

1. Confirm the user clearly intends to start the issue and create a branch/worktree.
2. Validate the issue number, then fetch the issue title, URL, labels, and Project context.
3. Resolve Project configuration env-first, then from `docs/reference/project-board.md`.
4. Ensure the issue has a Project item, adding it if needed, and retry item lookup up to 5 times.
5. Set the issue Project item to `Status=In Progress`; do not add any status label.
6. Derive the branch slug from the issue title after stripping `epic:`, `task:`, `bug:`, or `chore:` prefix.
7. Derive the branch/worktree prefix from `type:*`: `type:bug` -> `fix`, `type:chore` -> `chore`, `type:task` or `type:epic` -> `feat`, fallback `feat`.
8. Create the branch as `<prefix>/<N>-<slug>` from latest `origin/main`.
9. Create the Codex worktree at `.aco-worktrees/<prefix>-<N>`, keeping the `.aco-worktrees` root.
10. Report the worktree path, branch name, issue URL, Project update result, and any warnings.

### Create Pull Request

Codex equivalent of Claude `/gh-pr`.

When creating a PR for tracked work:

1. Confirm the user clearly intends to create a GitHub PR.
2. Gather the linked issue number and optional parent epic.
3. Resolve Project configuration env-first, then from `docs/reference/project-board.md`.
4. Fetch the linked issue title, body, labels, URL, and actual local changes with git diff/log.
5. Derive a conventional PR title from the actual change: `feat(scope):`, `fix(scope):`, `chore(scope):`, or `docs(scope):`.
6. Write a substantive PR body with `Closes #N`, `What`, `Why`, `Changes`, and `Checklist`; do not create a PR from placeholder text. Write PR body prose and checklist item descriptions in Korean by default, while keeping `Closes #N`, labels, file paths, command names, and established Markdown headings in English.
7. Create the PR with `gh pr create --body-file` or the available GitHub connector.
8. Add the PR to the active Project and set PR `Status=In Review`.
9. Move every linked issue item to `Status=In Review`, retrying Project item lookup up to 5 times.
10. Copy only durable labels from linked issues to the PR: `type:*`, `area:*`, and `origin:review`.
11. Keep priority and size on issue Project fields, not PR labels.
12. If a parent epic was provided, verify linkage and remind the user to check the epic child checklist after merge.
13. Report the PR URL, linked issues moved to `In Review`, labels synced, Project results, parent reminder, and warnings.

### Handle Review Follow-up

Codex equivalent of Claude `/gh-pr-followup`.

Use this workflow when the user asks Codex to triage unresolved PR review threads.

1. Confirm the user clearly intends to fetch or mutate review follow-up state for PR `#N`.
2. Resolve Project configuration env-first, then from `docs/reference/project-board.md`.
3. Fetch unresolved review threads using GitHub MCP tools or `gh api graphql`.
4. Categorize each unresolved thread as an immediate fix, deferred issue, or needs user decision.
5. For immediate fixes, make the local code change, reply with a concise fix summary, and resolve the thread only when the user asked Codex to handle review follow-up.
6. For deferred issues, use only `task`, `bug`, or `chore`; never create an `epic` from a review thread without separate user instruction.
7. Generate each deferred issue body with `.agents/skills/github-kanban-ops/scripts/make_issue_body.py`, including the review comment, affected path or line, deferred scope, acceptance criteria, and PR reference in `Notes`.
8. Create each deferred issue with `type:<type>`, `origin:review`, and optional `area:*` labels only.
9. Add deferred issues to the active Project, set `Status=Backlog`, and set assessed `Priority` when confidence is sufficient.
10. If priority confidence is too low, leave `Priority` unset and report `Priority unset for deferred issue — triage needed`.
11. Report resolved threads, deferred issue URLs, Project status and Priority results, review replies, and warnings.

### Plan or Triage

When planning or triaging:

1. Review `Status`, `Priority`, labels, and parent linkage.
2. Move incomplete or blocked work to explicit statuses.
3. Split oversized work into smaller issues.
4. Surface blockers, missing owners, and ambiguous acceptance criteria.
5. Keep backlog items in `Backlog` or `Ready`; do not leave them in active states.

### Report Progress

When asked for status:

1. Summarize by epic, milestone, or project status.
2. Distinguish `In Review`, blocked work, and `Done`.
3. Call out scope creep, missing breakdowns, and stale work items.
4. Recommend the next board hygiene action if the project state is inconsistent.

## Issue Authoring Rules

Use `scripts/make_issue_body.py` to scaffold issue bodies. Then tailor the output to the repository context.

Minimum rules:

- Every issue must have a clear outcome, not just an activity.
- Every issue must include acceptance criteria or a definition of done.
- Bugs must include actual behavior, expected behavior, reproduction, impact, and fix acceptance criteria.
- Epics must list child deliverables or a tasklist.
- Tasks and chores should reference their parent epic when one exists.
- Parent relationships should use native GitHub parent/sub-issues when supported.

## Guardrails

- Do not invent a second tracking system outside GitHub unless the user explicitly asks for one.
- Do not create redundant custom fields if labels or existing fields already cover the need cleanly.
- Prefer the smallest compatible project model: `Status` required, `Priority` recommended, `Size` and `Target date` optional.
- Do not use sprint, spike, or story concepts in this repository's canonical GitHub workflow.
- When repository conventions conflict with this model, preserve local conventions and explain the tradeoff.
