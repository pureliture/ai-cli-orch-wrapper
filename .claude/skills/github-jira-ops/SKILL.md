---
name: github-jira-ops
description: Manage a repository with GitHub Projects v2, Issues, milestones, labels, and issue relationships in a Jira-style operating model. Use when Codex needs to set up or run backlog triage, epics, stories, tasks, bugs, sprint planning, release planning, project board hygiene, or structured issue creation on GitHub.
---

# GitHub Jira Ops

Treat GitHub Projects v2 as the board, GitHub Issues as the work items, milestones as release buckets, and issue links/tasklists as hierarchy. Use this skill to keep that model consistent instead of improvising per request.

## Quick Start

1. Inspect the current repository state before making changes.
2. Detect whether a Jira-like model already exists.
3. Reuse existing labels, milestones, project fields, and templates when they are close enough.
4. Normalize the workflow to the reference model in [references/github-jira-model.md](./references/github-jira-model.md) only where gaps matter.
5. Create or update issues and project items in a way that preserves one source of truth per dimension.

## Context Build

Check these surfaces first:

- Repository labels
- Open issues and recent closed issues
- Milestones
- Project v2 fields, views, and status options
- Existing issue templates or contributing docs
- Existing hierarchy conventions such as parent issues, tasklists, or cross-links

Prefer GitHub MCP tools when available. If they are not available, use `gh` CLI. Do not assume the project board schema until you inspect it.

## Default Operating Model

Use the model in [references/github-jira-model.md](./references/github-jira-model.md).

Default mapping:

- Project fields hold workflow state: `Status`, `Priority`, `Size`, `Sprint`, `Target date`
- Labels hold durable classification: `type:*`, `area:*`
- Milestones hold releases or larger delivery targets
- Epic hierarchy lives in issues, links, and tasklists, not in a second external tracker

Do not duplicate workflow status across both labels and project fields unless the repository already does so and changing it would be disruptive.

## Execution Patterns

### Set Up Jira-Style GitHub Management

When the user wants setup or cleanup:

1. Audit the current board, labels, milestones, and templates.
2. Propose the smallest normalization needed.
3. Create or align:
   - Project fields and status values
   - Type and area labels
   - Milestone usage
   - Issue body structure
4. Document the agreed conventions in the repo only if the user asks for persistent project docs.

### Create Work Items

When creating epics, stories, tasks, bugs, spikes, or chores:

1. Pick the issue type from the reference model.
2. Generate a consistent issue body with `scripts/make_issue_body.py`.
3. Add the issue to the project.
4. Set project fields instead of encoding everything in prose.
5. Link the issue to its parent epic or release milestone.

Use concise issue titles. Put acceptance criteria and scope boundaries in the body, not in labels.

### Plan or Triage a Sprint

When planning or triaging:

1. Review `Status`, `Priority`, `Size`, `Sprint`, and milestone alignment.
2. Move incomplete or blocked items to explicit statuses.
3. Split oversized work into smaller issues.
4. Surface blockers, missing owners, and ambiguous acceptance criteria.
5. Keep backlog items in `Backlog` or `Ready`; do not leave them in active states.

### Report Progress

When asked for status:

1. Summarize by epic, sprint, or milestone.
2. Distinguish `In Review`, `Blocked`, and `Done`.
3. Call out scope creep, missing breakdowns, and stale work items.
4. Recommend the next board hygiene action if the project state is inconsistent.

## Issue Authoring Rules

Use `scripts/make_issue_body.py` to scaffold issue bodies. Then tailor the output to the repository context.

Minimum rules:

- Every issue must have a clear outcome, not just an activity
- Every issue except chores should include acceptance criteria
- Bugs must include actual behavior, expected behavior, and a reproducible path
- Epics must list child deliverables or a tasklist
- Stories and tasks should reference their parent epic when one exists

## Guardrails

- Do not invent a second tracking system outside GitHub unless the user explicitly asks for one.
- Do not create redundant custom fields if labels or milestones already cover the need cleanly.
- Do not migrate the entire board schema if a smaller compatibility layer works.
- Prefer incremental cleanup over big-bang process changes.
- When repository conventions conflict with the default model, preserve local conventions and explain the tradeoff.
