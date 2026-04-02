## ADDED Requirements

### Requirement: Provider implements IProvider interface
Each provider SHALL implement the `IProvider` TypeScript interface with methods: `isAvailable()`, `checkAuth()`, `buildArgs(command, options)`, and `invoke(prompt, options)`.

#### Scenario: Interface compliance enforced at compile time
- **WHEN** a new provider class is added to `packages/wrapper/src/providers/`
- **THEN** TypeScript compiler rejects the file if any `IProvider` method is missing or has an incompatible signature

### Requirement: GeminiProvider maps to gemini CLI
`GeminiProvider` SHALL implement `IProvider` and invoke the `gemini` binary found in PATH, passing the prompt via stdin and capturing streamed output.

#### Scenario: Gemini invocation with prompt
- **WHEN** wrapper calls `GeminiProvider.invoke(prompt, options)`
- **THEN** `gemini` binary is spawned with appropriate flags; prompt is written to its stdin; output is yielded as an async iterable

#### Scenario: Gemini not available
- **WHEN** `GeminiProvider.isAvailable()` is called and `gemini` is not in PATH
- **THEN** method returns `false`

### Requirement: CopilotProvider maps to copilot CLI
`CopilotProvider` SHALL implement `IProvider` and invoke the `copilot` binary found in PATH.

#### Scenario: Copilot invocation with prompt
- **WHEN** wrapper calls `CopilotProvider.invoke(prompt, options)`
- **THEN** `copilot` binary is spawned with appropriate flags; prompt is written to its stdin; output is yielded as an async iterable

#### Scenario: Copilot not available
- **WHEN** `CopilotProvider.isAvailable()` is called and `copilot` is not in PATH
- **THEN** method returns `false`

### Requirement: Provider registry allows lookup by name
The wrapper SHALL maintain a provider registry that maps string keys (`"gemini"`, `"copilot"`) to provider instances and allows registering additional providers at runtime.

#### Scenario: Lookup existing provider
- **WHEN** wrapper calls `providerRegistry.get("gemini")`
- **THEN** registry returns the `GeminiProvider` instance

#### Scenario: Register custom provider
- **WHEN** code calls `providerRegistry.register("my-provider", myProviderInstance)`
- **THEN** subsequent `providerRegistry.get("my-provider")` returns that instance

### Requirement: Provider checkAuth reports authentication status
`checkAuth()` SHALL return an object `{ ok: boolean, hint?: string }` where `hint` contains an actionable message when `ok` is `false`.

#### Scenario: Auth OK
- **WHEN** provider CLI is installed and authenticated
- **THEN** `checkAuth()` returns `{ ok: true }`

#### Scenario: Auth missing
- **WHEN** provider CLI is not authenticated
- **THEN** `checkAuth()` returns `{ ok: false, hint: "<install or auth command>" }`
