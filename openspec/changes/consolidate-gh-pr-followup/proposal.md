## Why

Currently, the PM workflow has `/gh-followup`, which is strictly used for deferring PR review comments into new issues for future sprints. However, there is no standardized slash command to handle immediate, quick-fix review comments (e.g., fetching open threads, applying the fix, replying, and resolving the thread). Developers have to manually manage this dual-path (immediate resolve vs. defer to issue). Consolidating this into a single, intelligent `/gh-pr-followup` command will streamline the review resolution process and prevent unnecessary issue creation for trivial fixes.

## What Changes

- **Deprecate**: The existing `/gh-followup` command will be replaced.
- **New Command**: Introduce `/gh-pr-followup` (and its `:multi` variant).
- **Intelligent Triage**: The new command will fetch unresolved review threads for a PR and ask the user (or intelligently decide based on constraints) whether to immediately resolve each thread (fix code + reply + resolve) or defer it (create a new issue with `origin:review`).
- **Interactive Execution**: Provide a flow where the user can batch-resolve simple comments and batch-defer complex ones.

## Capabilities

### New Capabilities
- `gh-pr-followup-cmd`: A unified command that handles both immediate code resolution of PR review threads and the creation of deferred followup issues.

### Modified Capabilities
- `gh-followup-cmd`: Replaced by `gh-pr-followup-cmd`.

## Impact

- `templates/commands/gh-followup.md` (and `.claude`, `.gemini` equivalents) will be renamed and rewritten as `gh-pr-followup.md`.
- Developers' workflow during the PR review phase will change from using raw GraphQL queries/manual commits to a structured, prompt-guided loop.
