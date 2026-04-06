## ADDED Requirements

### Requirement: Repository SHALL track OpenSpec workflow assets
The repository SHALL keep the OpenSpec initialization outputs required to continue spec-driven work, including the root OpenSpec config, repository prompt surfaces, and reusable skill definitions.

#### Scenario: Contributor inspects workflow assets
- **WHEN** a contributor searches the repository for OpenSpec workflow files
- **THEN** the repository exposes `openspec/config.yaml`, prompt files under `.github/prompts/`, skill files under `.github/skills/`, and the Claude-side helper surfaces under `.claude/`

### Requirement: Repository SHALL define a documented continuation path
The repository SHALL document how contributors create, inspect, validate, and continue OpenSpec changes after initialization.

#### Scenario: Contributor resumes an unfinished OpenSpec task
- **WHEN** a contributor opens the repository after OpenSpec has been initialized
- **THEN** the repository documentation identifies the primary `openspec` commands for listing changes, checking status, reading instructions, and validating artifacts

### Requirement: OpenSpec changes SHALL become apply-ready before implementation
An in-progress OpenSpec task SHALL define proposal, spec, design, and task artifacts before contributors treat the change as implementation-ready.

#### Scenario: Contributor checks readiness for implementation
- **WHEN** the contributor runs `openspec status --change <name>`
- **THEN** the change reports `tasks` as complete before the work is considered ready for implementation
