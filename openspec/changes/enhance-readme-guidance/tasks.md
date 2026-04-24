## 1. Baseline Alignment

- [x] 1.1 Treat the latest `origin/main` README as the baseline and preserve its current top-level heading structure
- [x] 1.2 Keep `현재 구현 범위`, case study, roadmap, and PR implementation plan framing intact while improving surrounding guidance
- [x] 1.3 Avoid adding dedicated top-level sections for OpenSpec workflow, provider model, or ccg-workflow compatibility unless a concrete unresolved gap appears

## 2. First-Use Flow

- [x] 2.1 Strengthen the install section with prerequisite and sequence guidance for npx and local checkout flows
- [x] 2.2 Clarify provider setup requirements, credential sources, and the difference between binary availability and remote authentication
- [x] 2.3 Include `aco sync --check` where it helps users understand read-only drift detection without implying it mutates generated targets

## 3. CLI and Architecture Orientation

- [x] 3.1 Replace or augment the dense CLI command block with scan-friendly command grouping
- [x] 3.2 Add a compact architecture diagram inside `Architecture at a Glance`
- [x] 3.3 Clarify source harness assets, generated target surfaces, provider execution, and session operations within existing sections

## 4. Repository and Documentation Navigation

- [x] 4.1 Expand `저장소 구조` enough to cover the main workspace, docs, shared skills, command templates, OpenSpec, and generated target surfaces
- [x] 4.2 Improve `문서` links with short descriptions for case study, roadmap, PR implementation plan, architecture, context sync, GitHub workflow, contributing, and runbook

## 5. Troubleshooting and Rendering Quality

- [x] 5.1 Expand `문제 해결` for missing `aco`, provider readiness/auth failure, stale slash commands, and sync drift
- [x] 5.2 Keep shell snippets copyable in fenced `bash` blocks and avoid mixing explanatory prose into command lines
- [x] 5.3 Review rendered Markdown quality for heading hierarchy, tables, fenced code blocks, diagrams, and link clarity

## 6. Additional Requirements

- [x] 6.1 State in `README.md` that this project is developed through the OpenSpec workflow
- [x] 6.2 Add `.gitmessage` as the repository commit message template
- [x] 6.3 Add a Korean commit-writing prompt that requires title plus body format and AI CLI/model contributor trailers
- [x] 6.4 Reference the commit template and prompt from `README.md`, `CLAUDE.md`, and `AGENTS.md` so Codex follows them when creating commits

## 7. Validation Follow-up

- [x] 7.1 Distinguish source implementation sync commands from currently published npm CLI behavior after `npx ... sync --check` validation failed
- [x] 7.2 Configure TypeScript to use official `@types/js-yaml` instead of a custom local declaration
- [x] 7.3 Apply review feedback to keep README sync command guidance on the concrete source-build command path

## 8. Review Guidelines

- [x] 8.1 Add Korean code review guidelines to `AGENTS.md` for Codex review behavior
- [x] 8.2 Add `GEMINI.md` with matching Korean code review guidelines for Gemini review behavior
- [x] 8.3 Update OpenSpec artifacts to include the AI connector review guideline requirement
