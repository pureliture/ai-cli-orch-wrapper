## Why

`/gh-issue` currently creates issues with sparse bodies because the command template only preserves `Parent epic: #N` and otherwise allows an empty body. Issue #44 showed the operational cost: the generated issue was not actionable enough and had to be rewritten manually after creation.

## What Changes

- Update `/gh-issue` to construct structured issue bodies with `Purpose`, `Scope & Requirements`, and `Acceptance Criteria`.
- Write issue body prose and checklist items in Korean by default while preserving conventional prefixes, labels, code identifiers, and established Markdown headings.
- Require concise follow-up questions when the provided context is too vague to fill the required body sections concretely.
- Use `gh issue create --body-file` instead of inline `--body` for multiline Markdown safety.
- Document the issue authoring contract in `docs/pm-board.md`.

## Impact

- `templates/commands/gh-issue.md`
- `.claude/commands/gh-issue.md`
- `docs/pm-board.md`
- New OpenSpec delta for `gh-issue-cmd`
