## Why

The root README has moved closer to a usable landing document on `origin/main`: it now explains the AI workflow harness purpose, current implementation scope, roadmap references, provider setup heuristics, and generated harness surfaces. The remaining gap is to strengthen that current structure without replacing the user-reviewed outline or duplicating deeper docs.

This change makes the README more operational and easier to scan in rendered Markdown so a first-time reader can follow install, provider setup, sync/status checks, command usage, architecture orientation, and troubleshooting from the README itself.

## What Changes

- Improve the existing README sections in place, preserving the current top-level headings from latest `origin/main`, including `현재 구현 범위`.
- Clarify the first-use path from prerequisites through install, provider setup, source-build sync checking, and session commands.
- Convert or augment dense command snippets with scan-friendly Markdown tables where that improves rendered readability.
- Add a compact architecture diagram inside the existing `Architecture at a Glance` section.
- Clarify source harness assets, generated target surfaces, and session/runtime responsibilities without adding a separate provider-model section.
- Expand troubleshooting with durable failure modes: missing `aco`, provider auth/CLI readiness, stale slash commands, sync drift, and public npm package lag relative to source implementation.
- Improve the document links section by describing when to use each linked doc, including the newly referenced case study, roadmap, and PR implementation plan.
- State that the project is developed through the OpenSpec change workflow.
- Add a repository commit message template and Korean commit-writing prompt for AI-assisted commits.
- Instruct Codex to follow the commit prompt and include AI CLI/model contributor trailers when drafting or creating commits.
- Add Korean code review guidelines to AI connector instruction surfaces so Codex and Gemini prioritize P0/P1 findings and include impact, rationale, fix direction, and validation guidance.
- Treat Markdown rendering quality as part of the work: heading hierarchy, tables, fenced code blocks, diagrams, link text, and scan order should render cleanly on GitHub and local Markdown viewers.
- Avoid adding dedicated top-level sections for OpenSpec workflow, provider model, or ccg-workflow compatibility.

## Capabilities

### New Capabilities
- `readme-guidance`: Defines requirements for strengthening the root README while preserving the current top-level structure from latest `origin/main` and improving rendered Markdown usability.

### Modified Capabilities

## Impact

- Affected files for implementation: `README.md`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.gitmessage`, `docs/guides/commit-message-prompt.md`
- Affected planning artifacts: `openspec/changes/enhance-readme-guidance/`
- Relevant documentation links: `docs/case-study.md`, `docs/roadmap.md`, `docs/pr-implementation-plan.md`, `docs/architecture.md`, `docs/reference/context-sync.md`, `docs/guides/github-workflow.md`, `docs/guides/contributing.md`, `docs/guides/runbook.md`
- No runtime APIs, package exports, dependencies, generated harness outputs, or CLI behavior change.
