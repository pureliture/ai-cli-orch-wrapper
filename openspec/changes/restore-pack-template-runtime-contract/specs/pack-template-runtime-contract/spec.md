## ADDED Requirements

### Requirement: Pack setup installs a complete runtime template surface
The system SHALL install all packaged command, provider prompt, and task preset templates needed by the documented pack runtime contract.

Pack setup SHALL perform fatal sync-conflict preflight before writing pack templates. The preflight SHALL abort only for true manifest-owned target conflicts; no-source workspaces and update-only drift SHALL continue to the install flow.

#### Scenario: Fresh setup installs commands prompts and tasks
- **WHEN** a user runs `aco pack setup` in a fresh target project from a source checkout, built package, or packaged tarball
- **THEN** the setup flow SHALL run sync preflight before writing pack templates
- **AND** install packaged command templates under `.claude/commands`
- **AND** install provider prompt templates under `.claude/aco/prompts`
- **AND** install task preset templates under `.claude/aco/tasks`
- **AND** record installed files in the pack install manifest.

#### Scenario: Sync conflict stops setup before template writes
- **WHEN** sync preflight detects a fatal conflict before pack templates are installed
- **THEN** `aco pack setup` SHALL fail before writing command, prompt, or task templates
- **AND** SHALL instruct the user to run `aco sync --check` or `aco sync --force` as appropriate.

#### Scenario: Post-install sync failure reports recovery
- **WHEN** sync preflight succeeds but the post-install sync step fails after pack templates are written
- **THEN** setup SHALL report that pack files may already be installed
- **AND** SHALL include the pack manifest path and `aco pack uninstall` as recovery guidance.

#### Scenario: No-source setup still installs pack templates
- **WHEN** sync preflight finds no Claude context sources in a fresh target project
- **THEN** `aco pack setup` SHALL continue installing command, prompt, and task templates
- **AND** SHALL report the post-install sync skip as non-fatal.

#### Scenario: Update-only drift does not block pack writes
- **WHEN** sync preflight reports stale generated outputs but no manifest-owned target conflicts
- **THEN** `aco pack setup` SHALL continue installing pack templates
- **AND** SHALL allow the post-install sync step to refresh generated outputs.

#### Scenario: Existing task preset is preserved without force
- **WHEN** `.claude/aco/tasks/review.md` already exists and the user runs `aco pack setup` without `--force`
- **THEN** the setup flow SHALL NOT overwrite the existing task preset
- **AND** SHALL report the skipped file consistently with existing command and prompt skip behavior.

#### Scenario: Force updates packaged task preset
- **WHEN** `.claude/aco/tasks/review.md` already exists and the user runs `aco pack setup --force`
- **THEN** the setup flow SHALL replace it with the packaged task preset
- **AND** SHALL keep the manifest entry for the installed file.

### Requirement: Documented provider commands resolve concrete prompt templates
The system SHALL make documented `aco run <provider> <command>` commands resolve concrete provider prompt templates instead of silently using the generic fallback prompt.

The documented provider command table SHALL be:

| Provider | Command | Prompt source | Installed target | Alias policy |
| -------- | ------- | ------------- | ---------------- | ------------ |
| `gemini` | `review` | `templates/prompts/gemini/review.md` | `.claude/aco/prompts/gemini/review.md` | none |
| `codex` | `review` | `templates/prompts/codex/review.md` | `.claude/aco/prompts/codex/review.md` | none |

#### Scenario: Gemini review uses packaged review prompt
- **WHEN** a user runs `aco run gemini review` after pack setup
- **THEN** the runtime SHALL select a Gemini review prompt template from `.claude/aco/prompts/gemini/review.md` or an explicitly documented and tested alias
- **AND** the runtime dashboard/session context SHALL expose the selected prompt template path.

#### Scenario: Codex review uses packaged review prompt
- **WHEN** a user runs `aco run codex review` after pack setup
- **THEN** the runtime SHALL select a Codex review prompt template from `.claude/aco/prompts/codex/review.md` or an explicitly documented and tested alias
- **AND** the runtime dashboard/session context SHALL expose the selected prompt template path.

#### Scenario: Unknown command fallback remains outside the documented contract
- **WHEN** a user runs `aco run <provider> <unknown-command>` for a command that is not part of the documented pack runtime contract
- **THEN** the runtime MAY continue to use the generic fallback prompt
- **AND** this fallback SHALL NOT be used to satisfy documented command tests.

#### Scenario: Documented command missing template fails fast
- **WHEN** a user runs `aco run gemini review` or `aco run codex review` after a broken or partial install with no packaged review prompt template available
- **THEN** the runtime SHALL fail before invoking the provider
- **AND** SHALL report the missing prompt template path and setup recovery guidance.

#### Scenario: Prompt resolution is tested without live provider invocation
- **WHEN** tests verify documented Gemini and Codex review prompt resolution
- **THEN** they SHALL use a side-effect-free internal prompt resolver module or an equivalent non-live inspection path
- **AND** SHALL NOT require live provider auth or network access.

### Requirement: Ask presets resolve from installed task templates
The system SHALL provide canonical task preset names that are installed by pack setup and consumed by `aco ask --preset`.

The documented preset table SHALL be:

| Preset | Task source | Installed target | Alias policy |
| ------ | ----------- | ---------------- | ------------ |
| `review` | `templates/tasks/review.md` | `.claude/aco/tasks/review.md` | none |
| `spec-critique` | `templates/tasks/spec-critique.md` | `.claude/aco/tasks/spec-critique.md` | none |
| `plan-critique` | `templates/tasks/plan-critique.md` | `.claude/aco/tasks/plan-critique.md` | none |
| `tdd` | `templates/tasks/tdd.md` | `.claude/aco/tasks/tdd.md` | none |
| `code-simplify` | `templates/tasks/code-simplify.md` | `.claude/aco/tasks/code-simplify.md` | none |
| `default` | `templates/tasks/default.md` | `.claude/aco/tasks/default.md` | none |

#### Scenario: Review preset works after setup
- **WHEN** a user runs `aco ask --preset review --dry-run` in a target project after pack setup
- **THEN** the command SHALL load `.claude/aco/tasks/review.md`
- **AND** report the preset in dry-run output without invoking providers.

#### Scenario: Spec plan and TDD presets have tested names
- **WHEN** documentation advertises preset names for spec critique, plan critique, or TDD workflows
- **THEN** each advertised preset name SHALL have a matching installed `.claude/aco/tasks/<name>.md` file or a documented and tested alias
- **AND** `aco ask --preset <name> --dry-run` SHALL resolve that preset.

#### Scenario: Missing preset error is actionable
- **WHEN** a user runs `aco ask --preset missing-preset --dry-run`
- **THEN** the command SHALL fail with a clear `Preset not found` message
- **AND** the documentation SHALL explain which preset names are packaged.

### Requirement: Local and tarball setup do not depend on published npm fallback
The system SHALL support `aco pack setup` from a local checkout or packaged tarball before the package is published to npm.

Machine-wide install or link behavior SHALL be explicit opt-in only and is outside the default #104 setup contract.

#### Scenario: Source checkout setup prefers current package
- **WHEN** a user runs the wrapper CLI from the repository checkout and invokes `aco pack setup`
- **THEN** binary placement SHALL verify the requested binary name first
- **AND** if the binary is missing or not this wrapper, setup SHALL report current package or executable recovery guidance instead of running `npm install -g @pureliture/ai-cli-orch-wrapper`
- **AND** setup SHALL NOT automatically install, link, replace, or remove global binaries
- **AND** setup SHALL NOT require the public npm package to already exist.

#### Scenario: Pack setup accepts binary name override
- **WHEN** a user runs `aco pack setup --binary-name aco-test-local`
- **THEN** setup SHALL verify `aco-test-local` rather than hard-coded `aco`
- **AND** use the same binary verification and recovery behavior as `aco pack install --binary-name aco-test-local`.

#### Scenario: Tarball setup uses packaged artifact
- **WHEN** a user installs a local `npm pack` tarball into a temporary target project and runs `aco pack setup`
- **THEN** setup SHALL use the tarball-installed package assets for commands, prompts, tasks, and binary behavior
- **AND** `aco --version` SHALL report the packaged wrapper version.

#### Scenario: Binary placement failure reports manual recovery
- **WHEN** setup cannot place or verify the `aco` binary from the current package artifact
- **THEN** setup SHALL report the exact attempted source and a manual recovery command
- **AND** SHALL NOT silently switch to an unrelated published package version.

#### Scenario: Setup rerun does not mutate global binary ownership
- **WHEN** a user reruns `aco pack setup` after receiving binary recovery guidance
- **THEN** setup SHALL repeat binary verification and guidance
- **AND** SHALL NOT remove, replace, or claim ownership of any global binary.

#### Scenario: Pack uninstall keeps binary ownership out of scope
- **WHEN** a user runs `aco pack uninstall`
- **THEN** uninstall SHALL remove only files recorded in the pack install manifest
- **AND** SHALL NOT remove global `aco` binaries or binaries outside the `.claude` target tree.

### Requirement: Package artifact parity is validated
The system SHALL include validation that detects stale build output or incomplete packaged templates before pilot use. The package contract validation SHALL be exposed as `npm run test:pack-runtime-contract --workspace=packages/wrapper` and SHALL NOT invoke live Codex or Gemini providers.

#### Scenario: Npm pack includes runtime assets
- **WHEN** the package is packed with `npm pack`
- **THEN** the tarball SHALL include built `dist` files
- **AND** include all packaged command, prompt, and task template files required by this contract.

#### Scenario: Smoke catches source versus tarball mismatch
- **WHEN** `npm run test:pack-runtime-contract --workspace=packages/wrapper` runs
- **THEN** it SHALL install the packed tarball into an isolated npm prefix with isolated `HOME` and `PATH`
- **AND** run the tarball-installed `aco --version`
- **AND** run the tarball-installed `aco pack setup`
- **AND** run tarball-installed `aco ask --preset <name> --dry-run` for documented presets
- **AND** run tarball-installed `aco run gemini review --input demo` with a fake local `gemini` provider binary to verify the packaged prompt template path without live provider auth
- **AND** verify that binary version and installed template paths come from the packed artifact, not a pre-existing global binary.

#### Scenario: Provider smoke remains separate
- **WHEN** runtime provider smoke is needed for Codex or Gemini
- **THEN** it SHALL be run through a separate opt-in command or runbook step
- **AND** SHALL NOT be part of `test:pack-runtime-contract`.

#### Scenario: Stale dist is detected before release
- **WHEN** source files affecting the CLI runtime contract change but `dist` is stale
- **THEN** validation SHALL fail or report a clear stale-build warning before the package is considered pilot-ready.

### Requirement: Documentation matches the tested runtime contract
The user-facing documentation SHALL describe only command names, preset names, install paths, and validation commands that are implemented and tested.

#### Scenario: Docs list canonical setup paths
- **WHEN** a user reads the README, wrapper README, runbook, or context-sync reference
- **THEN** each document SHALL distinguish source checkout, local tarball, and published npm setup paths
- **AND** SHALL avoid implying that unpublished packages are available from the public npm registry.

#### Scenario: Docs list tested commands and presets
- **WHEN** documentation mentions `aco run gemini review`, `aco run codex review`, or `aco ask --preset <name>`
- **THEN** each mentioned command or preset SHALL be covered by a test or smoke validation
- **AND** SHALL match the installed template filenames or documented aliases.

#### Scenario: Runtime verification is separated from live provider smoke
- **WHEN** documentation describes validation for this contract
- **THEN** it SHALL separate repo tests and mock/dry-run package smoke from opt-in live Codex/Gemini provider smoke
- **AND** SHALL NOT claim live provider delivery unless that smoke was actually run.
