## ADDED Requirements

### Requirement: Single public npm package
The system SHALL publish the product as a single public npm package named `@pureliture/ai-cli-orch-wrapper`.

#### Scenario: Package metadata exposes the product package
- **WHEN** the release pipeline evaluates publishable package metadata
- **THEN** it SHALL identify `@pureliture/ai-cli-orch-wrapper` as the public npm package to publish

#### Scenario: Legacy split packages are not public publish targets
- **WHEN** changesets or npm publish logic scans workspace packages
- **THEN** `@aco/wrapper`, `aco-install`, `@pureliture/aco-wrapper`, and `@pureliture/aco-install` SHALL NOT be published as public product packages

### Requirement: Single public CLI binary
The system SHALL expose `aco` as the single public CLI binary for the npm package.

#### Scenario: User installs the package
- **WHEN** a user installs `@pureliture/ai-cli-orch-wrapper`
- **THEN** the package SHALL provide an executable `aco` binary

#### Scenario: Installer binary is not public API
- **WHEN** a user reads package metadata or user documentation
- **THEN** `aco-install` SHALL NOT be presented as the supported public CLI entrypoint

### Requirement: Pack and provider setup commands are routed through aco
The `aco` CLI SHALL include install/setup subcommands that replace the public `aco-install` command surface.

#### Scenario: Pack install command
- **WHEN** a user runs `aco pack install`
- **THEN** the CLI SHALL execute the command-pack installation flow formerly exposed through the installer command surface

#### Scenario: Pack setup command
- **WHEN** a user runs `aco pack setup`
- **THEN** the CLI SHALL verify or prepare command-pack and provider readiness using the setup flow

#### Scenario: Provider setup command
- **WHEN** a user runs `aco provider setup gemini`
- **THEN** the CLI SHALL execute the Gemini provider setup guidance or installation flow

#### Scenario: Runtime command remains available
- **WHEN** a user runs `aco run ...`
- **THEN** the CLI SHALL continue to execute the runtime provider command flow

### Requirement: Documentation reflects the public package and CLI surface
User-facing documentation SHALL describe `@pureliture/ai-cli-orch-wrapper` and `aco` as the supported npm package and CLI.

#### Scenario: Documentation is searched for old public names
- **WHEN** documentation is searched for `@aco/wrapper`, `aco-install`, `@pureliture/aco-wrapper`, or `@pureliture/aco-install`
- **THEN** those names SHALL NOT appear as the intended public npm package or CLI model

#### Scenario: Documentation shows supported commands
- **WHEN** a user reads installation or runbook documentation
- **THEN** it SHALL show `aco pack install`, `aco pack setup`, `aco provider setup gemini`, and `aco run ...` as supported commands

### Requirement: CI smoke uses the consolidated scoped package tarball
The CI smoke workflow SHALL install the tarball for `@pureliture/ai-cli-orch-wrapper` and SHALL NOT depend on stale `aco-wrapper-*.tgz` tarball globs.

#### Scenario: npm pack creates a scoped tarball
- **WHEN** CI runs `npm pack` for `@pureliture/ai-cli-orch-wrapper`
- **THEN** the smoke workflow SHALL locate the generated tarball for that package even though the tarball filename uses scoped-package naming

#### Scenario: Smoke test installs the product CLI
- **WHEN** the smoke workflow installs the packed tarball into a local prefix
- **THEN** `aco --version` SHALL be available from the installed package

### Requirement: Release automation publishes only the consolidated package
Release automation SHALL be configured so changesets/npm publish target the consolidated package model.

#### Scenario: Release workflow publishes
- **WHEN** the release workflow reaches npm publish
- **THEN** it SHALL publish `@pureliture/ai-cli-orch-wrapper` rather than the old wrapper/installer split packages

#### Scenario: Release avoids package-name-related failures
- **WHEN** the release workflow validates package metadata
- **THEN** it SHALL NOT fail because of stale `@aco/wrapper`, `aco-install`, `@pureliture/aco-wrapper`, or `@pureliture/aco-install` package names
