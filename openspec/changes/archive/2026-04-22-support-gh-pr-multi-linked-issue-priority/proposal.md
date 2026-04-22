## Why

`/gh-pr` already states that a PR linked to multiple issues should inherit the highest priority label, but the command flow still extracts only one closing reference from the PR body. That mismatch leaves multi-issue PR behavior underspecified and makes the prompt, fallback automation, and spec scenarios inconsistent.

## What Changes

- Update `/gh-pr` linked-issue parsing to collect all `Closes`/`Fixes`/`Resolves` references from the PR body instead of a single issue number.
- Define an explicit priority resolution policy for multiple linked issues: choose the highest priority label across linked issues (`p0 > p1 > p2`), defaulting to `p1` when none are present.
- Clarify how linked-issue status updates and PR label inheritance behave when more than one issue is referenced.
- Add spec scenarios that cover multi-linked-issue priority inheritance so future prompt or script edits cannot reintroduce the contradiction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `gh-pr-cmd`: `/gh-pr` must parse multiple closing keywords from the PR body and follow a deterministic multi-linked-issue flow.
- `gh-pr-priority-label`: PR priority inheritance must resolve across multiple linked issues using an explicit precedence rule.
- `gh-pr-project-status`: linked issue status updates must apply to every referenced issue rather than only the first parsed issue.

## Impact

- `templates/commands/gh-pr.md` and `.claude/commands/gh-pr.md`
- `scripts/pm-hook.sh` linked-issue extraction and priority sync logic
- Multi-issue scenario coverage for `/gh-pr` command behavior
