## Why

The repository has been initialized for OpenSpec and already contains generated OpenSpec prompts and skills, but it does not yet define the change as an OpenSpec artifact set. Without a proposal, specs, design, and tasks, the new workflow cannot be validated or continued in a consistent way.

## What Changes

- Add an OpenSpec change that defines how this repository stores and uses OpenSpec workflow assets.
- Document the generated prompt and skill surfaces under `.github/` and `.claude/`.
- Add repository documentation so contributors know how to inspect, continue, and validate OpenSpec-driven work in this repo.

## Capabilities

### New Capabilities
- `openspec-workflow-assets`: Define the required repository structure and contributor workflow for OpenSpec prompts, skills, change artifacts, and validation steps.

### Modified Capabilities

## Impact

- Affected paths: `openspec/`, `README.md`, `docs/RUNBOOK.md`, `.github/prompts/`, `.github/skills/`, `.claude/commands/`, `.claude/skills/`
- No runtime APIs or dependencies change.
- Primary impact is contributor workflow and repository documentation.
