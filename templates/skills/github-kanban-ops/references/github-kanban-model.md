# GitHub Kanban Model

Use this file when the repository needs a concrete default operating model for GitHub Issues, Pull Requests, and the active repository GitHub Project.

## Project Fields

Required:

- `Status`: `Backlog`, `Ready`, `In Progress`, `In Review`, `Done`

Recommended:

- `Priority`: `P0`, `P1`, `P2`

Optional:

- `Size`: `S`, `M`, `L`
- `Target date`: optional due date for committed work

If the project already has equivalent fields, map to them instead of renaming everything. Do not add a field unless the workflow needs it.

## Labels

Use labels for durable classification only.

Required type labels:

- `type:epic`
- `type:task`
- `type:bug`
- `type:chore`

Do not create alternate type labels such as `type:feature`, `type:story`, or `type:spike`. Feature-like implementation work is `type:task`; multi-issue outcomes are `type:epic`.

Recommended area labels:

- `area:wrapper`
- `area:installer`
- `area:templates`
- `area:ci`
- `area:ops`

Conditional labels:

- `origin:review`

Avoid labels for state, priority, size, or planning buckets:

- `status:*`
- `sprint:*`
- `p0`, `p1`, `p2`
- `size:*`

## Milestones

Use milestones for releases, phases, or externally meaningful delivery targets.

Examples:

- `v0.3.0`
- `MVP`
- `Aco v2 wrapper parity`

Do not use milestones as sprint buckets.

## Issue Types

### Epic

Use for a multi-issue outcome.

Include:

- Summary
- Outcome
- Scope
- Child issue list or tasklist
- Exit criteria

### Task

Use for bounded implementation, improvement, investigation, or product work.

Include:

- Summary
- Outcome
- Parent epic when one exists
- Scope
- Acceptance criteria
- Notes when useful

### Bug

Use for broken behavior or regressions.

Include:

- Summary
- Actual behavior
- Expected behavior
- Reproduction steps
- Impact
- Parent epic when one exists
- Fix acceptance criteria

### Chore

Use for maintenance work with low product ambiguity.

Include:

- Summary
- Operational goal
- Constraints
- Parent epic when one exists
- Definition of done

## Hierarchy and Linking

Preferred pattern:

- Epic issue owns the child list.
- Child issues link back to the epic.
- Native parent/sub-issues are the primary relationship when available.
- Body-level `Parent` sections are a portable fallback.
- Parent epic checklists use `- [ ] #N` when practical.

## Board Hygiene Rules

- `Backlog`: not ready to start
- `Ready`: refined and unblocked
- `In Progress`: actively worked on
- `In Review`: implementation done, awaiting review or validation
- `Done`: merged or otherwise complete

Review for hygiene during triage:

- Missing `type:*` label
- Missing project item
- Missing priority on active work when the project has a Priority field
- Missing parent epic for child tasks when an epic exists
- Oversized items with unclear acceptance criteria
- Stale blocked work without blocker notes

## Workflow Rules

Planning:

1. Pull `Ready` work by priority and size.
2. Reject items without acceptance criteria or a definition of done.
3. Keep at least one small, independent issue available per active contributor.

Mid-cycle triage:

1. Reconfirm blockers.
2. Split work that has grown.
3. Move review-complete work to `Done`.

Closeout:

1. Roll unfinished items back to `Backlog` or keep them `Ready`.
2. Capture follow-up issues from bugs, review feedback, or spillover.
