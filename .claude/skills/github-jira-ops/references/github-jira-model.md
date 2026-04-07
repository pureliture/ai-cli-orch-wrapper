# GitHub Jira Model

Use this file when the repository needs a concrete default operating model.

## Project Fields

Recommended GitHub Projects v2 fields:

- `Status`: `Backlog`, `Ready`, `In Progress`, `In Review`, `Blocked`, `Done`
- `Priority`: `P0`, `P1`, `P2`, `P3`
- `Size`: `XS`, `S`, `M`, `L`, `XL`
- `Sprint`: iteration or sprint label for the current planning cycle
- `Target date`: optional due date for committed work

If the board already has equivalent fields, map to them instead of renaming everything.

## Labels

Use labels for durable classification only.

Recommended prefixes:

- `type:epic`
- `type:story`
- `type:task`
- `type:bug`
- `type:spike`
- `type:chore`
- `area:cli`
- `area:wrapper`
- `area:docs`
- `area:spec`
- `area:infra`

Avoid status labels such as `in-progress` or `done` when the project already has a `Status` field.

## Milestones

Use milestones for releases, phases, or externally meaningful delivery targets.

Examples:

- `v0.3.0`
- `MVP`
- `Aco v2 wrapper parity`

Do not overload milestones as short sprint buckets unless the repository already relies on that pattern.

## Issue Types

### Epic

Use for a multi-issue outcome that spans several stories or tasks.

Include:

- Problem or opportunity
- Outcome statement
- Scope
- Child issue list or tasklist
- Exit criteria

### Story

Use for user-visible or workflow-visible value that can usually ship independently.

Include:

- Context
- Outcome
- Acceptance criteria
- Parent epic

### Task

Use for a bounded implementation item that supports a story or epic.

Include:

- Why it exists
- Deliverable
- Acceptance criteria
- Parent issue

### Bug

Use for broken behavior or regressions.

Include:

- Actual behavior
- Expected behavior
- Reproduction steps
- Impact
- Fix acceptance criteria

### Spike

Use for time-boxed investigation.

Include:

- Question to answer
- Scope boundary
- Expected output
- Time box

### Chore

Use for maintenance work with low product ambiguity.

Include:

- Operational goal
- Constraints
- Definition of done

## Hierarchy and Linking

Preferred pattern:

- Epic issue owns the child list
- Child issues link back to the epic
- Release milestone groups the work that ships together
- Sprint-scoped work uses `[Sprint <id>][<Type>]` title prefixes
- Sprint planning uses one sprint epic with child task, bug, spike, story, or chore issues

If GitHub tasklists are available, keep the parent epic's tasklist current. If they are not, maintain a plain markdown checklist in the epic body.

## Board Hygiene Rules

- `Backlog`: not ready to start
- `Ready`: refined and unblocked
- `In Progress`: actively worked on
- `In Review`: implementation done, awaiting review or validation
- `Blocked`: cannot move until dependency or decision clears
- `Done`: merged or otherwise complete

Review for hygiene during triage:

- Missing type label
- Missing project item
- Missing sprint on active work
- Missing parent epic for stories and tasks
- Oversized items with unclear acceptance criteria
- Stale blocked work without blocker notes

## Sprint Rituals

Sprint planning:

1. Pull `Ready` work by priority and size.
2. Reject items without acceptance criteria.
3. Keep at least one small, independent issue available per active contributor.

Mid-sprint triage:

1. Reconfirm blockers.
2. Split work that has grown.
3. Move review-complete work to `Done`.

Sprint close:

1. Roll unfinished items back to `Backlog` or keep them `Ready`.
2. Remove stale sprint assignments.
3. Capture follow-up issues from bugs or spillover.
