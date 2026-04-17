## MODIFIED Requirements

### Requirement: Supported Providers
The `aco` runtime SHALL officially support and map to the Gemini and Claude CLI providers. The Copilot provider is explicitly removed from the v2 baseline mappings to ensure documentation parity and simplify the architectural surface.

#### Scenario: User requests an unsupported provider
- **WHEN** a user specifies or resolves to the Copilot provider
- **THEN** the system MUST fail fast with an "unsupported provider" error

### Requirement: Blocking Execution Contract
The `aco` runtime SHALL execute providers as blocking subprocesses. The execution contract MUST include establishing a new process group for the provider and capturing its `pgid`. This ensures that signal handling (SIGTERM/SIGINT) can reliably terminate the entire process tree of the provider, preventing zombie processes.

#### Scenario: Provider spawns child processes
- **WHEN** the `aco` runtime spawns a provider that creates its own subprocesses
- **THEN** the runtime MUST assign the provider to a new process group and use the `pgid` to send termination signals to the entire group
