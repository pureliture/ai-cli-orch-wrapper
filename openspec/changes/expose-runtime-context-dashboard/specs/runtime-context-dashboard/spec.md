## ADDED Requirements

### Requirement: Runtime dashboard SHALL be shown for provider-backed sessions
The system SHALL show a runtime dashboard when `aco` starts a provider-backed session so users can see which provider is active and what execution context is being used.

#### Scenario: Interactive provider run shows colorful dashboard
- **WHEN** a user runs `aco run <provider> <command>` in an interactive terminal
- **THEN** the system SHALL display a visually distinct runtime dashboard before provider output begins
- **AND** the dashboard SHALL include emoji-enhanced provider activation, status indicators, and compact runtime facts

#### Scenario: Provider run identifies active session
- **WHEN** the runtime dashboard is displayed for a provider run
- **THEN** it SHALL show the active provider, command, session id, permission profile, working directory or branch, and prompt template path when known

### Requirement: Dashboard SHALL distinguish active runtime from exposed context
The system SHALL distinguish context that is active in the current `aco` run from context surfaces merely exposed to Codex or Gemini.

#### Scenario: Active context is displayed
- **WHEN** `aco` directly invokes a provider for a command
- **THEN** the dashboard SHALL list the provider, command, session id, permission profile, and prompt template under an active runtime section

#### Scenario: Exposed context surfaces are displayed
- **WHEN** Codex or Gemini target context files exist in the working tree
- **THEN** the dashboard SHALL summarize exposed agents, shared skills, and hooks under a separate exposed context section
- **AND** it SHALL NOT claim that exposed agents, skills, or hooks were selected unless `aco` directly selected them

#### Scenario: No exposed context exists
- **WHEN** no generated agents, shared skills, or hook configuration are found for the selected provider
- **THEN** the dashboard SHALL show a concise empty or unavailable state instead of failing the provider run

### Requirement: Provider readiness SHALL include safe auth and install details
The system SHALL expose safe provider readiness details in the runtime dashboard without revealing secrets.

#### Scenario: Auth method is known
- **WHEN** provider auth succeeds through an API key, OAuth credentials, or CLI fallback
- **THEN** the dashboard SHALL show a safe auth method label such as `api-key`, `oauth`, or `cli-fallback`
- **AND** it SHALL NOT show API key values, OAuth tokens, or auth file contents

#### Scenario: Provider is missing or unauthenticated
- **WHEN** provider installation or authentication is missing
- **THEN** the dashboard or setup/status output SHALL show a concise not-ready state and the existing remediation hint
- **AND** it SHALL NOT expose sensitive environment variable values or credential file contents

#### Scenario: Provider version is available
- **WHEN** a provider binary version can be read without requiring interactive auth
- **THEN** the dashboard MAY show the provider version or binary path as non-secret diagnostic context

### Requirement: Dashboard output SHALL preserve provider stdout contracts
The runtime dashboard SHALL avoid polluting provider stdout so callers can continue to consume raw provider output and sentinel or meta lines.

#### Scenario: Dashboard renders before provider output
- **WHEN** `aco run` renders a runtime dashboard
- **THEN** decorative dashboard output SHALL be written to stderr or another non-provider-output channel
- **AND** provider stdout SHALL remain reserved for provider output and existing meta/sentinel contracts

#### Scenario: Session output log is written
- **WHEN** provider output is tee'd to a session output log
- **THEN** the log SHALL preserve provider output without decorative dashboard lines unless the log is explicitly documented as including runtime UI

### Requirement: Dashboard formatting SHALL adapt to terminal environment
The system SHALL render colorful output for interactive terminals and stable plain output for automation environments.

#### Scenario: TTY supports decoration
- **WHEN** stderr is a TTY and neither `NO_COLOR` nor `CI` is set
- **THEN** the dashboard SHALL use ANSI styling and emoji-enhanced labels for provider activation and status

#### Scenario: Decoration is disabled
- **WHEN** stderr is not a TTY or `NO_COLOR` or `CI` is set
- **THEN** the dashboard SHALL use plain text without ANSI color sequences
- **AND** the output SHALL remain readable in logs

### Requirement: Session metadata SHALL persist non-secret runtime context
The system SHALL persist non-secret runtime dashboard metadata so later status commands can summarize the session.

#### Scenario: Session is created
- **WHEN** `aco` creates a provider session
- **THEN** it SHALL persist non-secret runtime metadata including provider, command, permission profile, auth readiness, active prompt template, and exposed context counts or names

#### Scenario: User checks session status later
- **WHEN** the user runs `aco status` for a session with runtime metadata
- **THEN** the status output SHALL include a concise summary of the active runtime context
- **AND** it SHALL omit secrets and full prompt content

### Requirement: Documentation SHALL show the changed runtime output
The system SHALL update user-facing documentation with representative command output or TUI examples after the dashboard behavior is implemented.

#### Scenario: README surfaces are reviewed
- **WHEN** the runtime dashboard implementation is complete
- **THEN** the implementer SHALL review root `README.md` and `packages/wrapper/README.md`
- **AND** update the files where the new runtime dashboard, provider status output, active/exposed distinction, or plain-output fallback needs to be explained

#### Scenario: Docs surfaces are reviewed
- **WHEN** the runtime dashboard implementation is complete
- **THEN** the implementer SHALL review relevant files under `docs/`
- **AND** add or update examples of the changed TUI or command output where those docs describe `aco run`, provider setup/status, session status, or Codex/Gemini runtime context

#### Scenario: Documentation examples avoid secrets
- **WHEN** documentation includes dashboard or command output examples
- **THEN** the examples SHALL use redacted or fake values for auth, paths, session ids, and provider details where needed
- **AND** the examples SHALL NOT include real API keys, OAuth tokens, or user-specific credential contents
