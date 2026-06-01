---
name: improve-codebase-architecture
description: Use when reviewing ai-cli-orch-wrapper architecture for provider-neutral CLI/runtime modules, context-sync surfaces, agents/skills, docs-driven architecture, test seams, or refactoring candidates affecting locality, maintainability, or AI-navigability.
x-aco-owned: true
x-aco-kind: shared-skill
---

# Improve Codebase Architecture

## Overview

Review architectural friction and surface deepening opportunities: refactors that turn shallow modules into deeper modules with smaller interfaces, stronger locality, and better test leverage.

This skill is read-only during the initial review. Produce candidates first; do not edit code, docs, config, tests, generated surfaces, or examples unless the user chooses a candidate and asks for follow-up implementation.

## Repository Guardrails

- Preserve provider-neutral behavior in `packages/wrapper/src/`. Put provider-specific behavior behind the provider abstraction.
- Respect the context-sync contract. Treat root `CLAUDE.md` as the Claude source, `AGENTS.md` as the generated target surface, and `.agents/skills/` as an allow-listed shared skill target.
- Do not hand-maintain `.codex/skills/` copies unless runtime evidence proves they are required.
- Keep `.claude/commands/gh-*.md` and `templates/commands/gh-*.md` aligned when command behavior changes.
- Keep `.agents/skills/github-kanban-ops/` and `.claude/skills/github-kanban-ops/` aligned when changing shared GitHub PM policy or scripts.
- Do not reintroduce sprint, story, spike, status-label, priority-label, or broad label-taxonomy concepts into the GitHub PM harness.
- Treat shell execution, file-system access, provider prompts, environment handling, and process lifecycle as security-sensitive. Flag secret exposure, command injection, path traversal, unsafe fallback, missing timeout, missing cleanup, and cancellation gaps.
- Follow active `AGENTS.md` rules for git worktrees, npm validation, `uv` for Python helpers, and subagent model policy.

## Vocabulary

Use `references/language.md` for exact architecture vocabulary. In review output, prefer these terms: module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.

Avoid substituting component, service, API, boundary, wrapper, or layer when the vocabulary term is more precise.

## Workflow

### 1. Read Context

Start with repo-local context before source code:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/architecture.md`
- `docs/contract/go-node-boundary.md`
- `docs/reference/context-sync.md`
- `docs/reference/project-board.md`
- `docs/guides/github-workflow.md`
- Relevant `openspec/changes/*/{proposal.md,design.md,tasks.md}` when a candidate touches an active change

If a listed file does not exist in the current checkout, continue from the available docs. Do not create missing docs during the initial review.

### 2. Explore Code And Tests

Walk the implementation and tests read-only. Focus on places where understanding one concept requires bouncing across many files, where the interface is almost as complex as the implementation, or where tests need to know too much about call ordering, config, subprocess behavior, file paths, prompt text, JSON shape, provider registry wiring, or sync manifest details.

For each suspected shallow module, apply the deletion test:

- If deleting it removes complexity, it is likely pass-through.
- If deleting it spreads complexity across callers, it is earning its keep.

Good candidates concentrate behavior behind one interface without expanding scope beyond accepted repo contracts.

Use read-only subagents when available for independent exploration of separable areas. Keep prompts scoped to investigation and require findings with file paths and evidence.

### 3. Produce Temp HTML Report

Write a self-contained HTML report to the OS temp directory, not the repo:

- macOS/Linux: `${TMPDIR:-/tmp}/architecture-review-<timestamp>.html`
- Windows: `%TEMP%/architecture-review-<timestamp>.html`

Use `references/html-report.md` for the report shape. The report may use Tailwind and Mermaid CDNs. Keep all repo facts public-safe and sanitized.

Each candidate card must include:

- Files involved
- Problem
- Proposed deepening
- Locality and leverage benefits
- Test impact
- Before/after diagram
- Recommendation strength: `Strong`, `Worth exploring`, or `Speculative`
- ADR/doc conflict callout only when real friction justifies reopening a decision

End with one top recommendation. Then ask which candidate the user wants to explore.

### 4. Follow-Up Grilling Loop

After the user picks a candidate, drill into constraints, dependencies, seam placement, adapter needs, and tests that should survive.

Do not jump directly to an interface proposal. If the user asks for interface alternatives, use `references/interface-design.md`.

If a decision should become durable project knowledge, propose the smallest doc update first. Write it only after the user confirms or explicitly asks.

## References

- `references/language.md`: architecture vocabulary and principles
- `references/html-report.md`: HTML report structure and diagram rules
- `references/interface-design.md`: follow-up interface design comparison workflow
- `references/source-license.md`: attribution for the original MIT-licensed skill this repo-local ACO adaptation is based on
