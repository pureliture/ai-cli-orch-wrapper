## ADDED Requirements

### Requirement: Provider runtime uses supported CLI flags only
The `aco delegate` provider runtime SHALL pass only flags supported by the selected provider CLI version and SHALL avoid speculative or dormant flags.

#### Scenario: Codex reasoning effort
- **WHEN** a Claude agent resolves to the Codex provider and contains `reasoningEffort`
- **THEN** the Codex runtime SHALL NOT pass `--reasoning-effort`
- **AND** the runtime SHALL either use a verified supported config override or omit the setting with a warning

#### Scenario: Gemini reasoning effort
- **WHEN** a Claude agent resolves to the Gemini CLI provider and contains `reasoningEffort`
- **THEN** the Gemini runtime SHALL NOT pass `--reasoning-effort`
- **AND** the runtime SHALL omit the setting because Gemini CLI does not expose an equivalent runtime flag

#### Scenario: Unsupported extra args
- **WHEN** formatter `launchArgs` include a provider flag that is known unsupported by the target provider
- **THEN** provider argument construction SHALL reject or filter the flag before spawning the provider
- **AND** return a clear configuration error or warning

### Requirement: Codex non-interactive invocation compatibility
The Codex provider SHALL invoke Codex through the current non-interactive `codex exec` command surface.

#### Scenario: Codex prompt execution
- **WHEN** `aco delegate` resolves a task to Codex
- **THEN** the provider SHALL invoke `codex exec` with supported options such as `--skip-git-repo-check`, `--model`, and approved sandbox/automation flags
- **AND** pass the combined prompt as the task prompt or stdin according to the supported `codex exec` interface

#### Scenario: Codex restricted mode
- **WHEN** the resolved agent has `permissionProfile: restricted` or `workspaceMode: read-only`
- **THEN** the Codex provider SHALL avoid full-auto edit permissions
- **AND** use a supported read-only sandbox configuration where possible

### Requirement: Gemini non-interactive invocation compatibility
The Gemini provider SHALL invoke Gemini through the current non-interactive `gemini --prompt` command surface.

#### Scenario: Gemini prompt execution
- **WHEN** `aco delegate` resolves a task to Gemini CLI
- **THEN** the provider SHALL invoke `gemini --prompt <combined-prompt>` with supported options only
- **AND** include `--model` only when a model was resolved

#### Scenario: Gemini approval mode
- **WHEN** the resolved agent requires edit-capable execution
- **THEN** the Gemini provider SHALL use only supported approval flags such as `--approval-mode` or `--yolo` when auto-approval is required
- **AND** SHALL NOT use deprecated or unsupported flags for the installed CLI surface

### Requirement: Provider compatibility verification
The system SHALL include tests or fixture checks that pin the expected provider argument construction for current Codex and Gemini CLI surfaces.

#### Scenario: Codex args fixture
- **WHEN** provider argument tests run for a Codex agent with model and reasoning effort
- **THEN** the expected argv SHALL include the model option
- **AND** SHALL NOT include `--reasoning-effort`

#### Scenario: Gemini args fixture
- **WHEN** provider argument tests run for a Gemini agent with model and reasoning effort
- **THEN** the expected argv SHALL include the model and prompt options
- **AND** SHALL NOT include `--reasoning-effort`

#### Scenario: CLI help drift
- **WHEN** provider CLI help output changes in a future version
- **THEN** compatibility fixtures SHALL be updated before enabling newly supported flags
