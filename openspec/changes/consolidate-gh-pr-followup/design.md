## Context

Currently, the `templates/commands/gh-followup.md` command only provides instructions for creating a new issue from a PR review comment. However, a common developer workflow involves fixing simple review comments immediately and marking them as "Resolved" on GitHub. Automating this flow requires fetching open review threads via the `gh api graphql`, modifying code, and then calling mutations (`addPullRequestReviewThreadReply` and `resolveReviewThread`).

## Goals / Non-Goals

**Goals:**
- Provide a single command `/gh-pr-followup` that can fetch all unresolved review threads for a given PR.
- Guide the AI to evaluate each thread: if it's a quick fix, modify the code, commit, reply, and resolve the thread. If it's a large task, defer it by creating a new issue (the old `/gh-followup` behavior).
- Provide robust GraphQL bash snippets within the prompt template to handle replying and resolving threads.

**Non-Goals:**
- Do not automate the code-writing itself within bash; rely on the AI agent to write the code and use the bash snippets solely for GitHub API interactions.

## Decisions

- **Decision 1: Unified Command**: We will merge the capability of `/gh-followup` (issue creation) with the new capability (thread resolution) into a single command named `/gh-pr-followup`. This reduces command sprawl and allows the AI to triage comments holistically in one session.
- **Decision 2: GraphQL for Thread Resolution**: The standard `gh` CLI does not have built-in commands for replying to and resolving individual review threads. We will use `gh api graphql` with the `resolveReviewThread` and `addPullRequestReviewThreadReply` mutations. The template will provide a ready-to-use bash script for the AI to execute these mutations.

## Risks / Trade-offs

- **Risk: Complex GraphQL Mutations**: GraphQL queries in bash can be brittle with quoting.
  - **Mitigation**: Provide a clean, robust, copy-pasteable bash script in the prompt template that handles the variables via `gh api -F` parameters safely.
