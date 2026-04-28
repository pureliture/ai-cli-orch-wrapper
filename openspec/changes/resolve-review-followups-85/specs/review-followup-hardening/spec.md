## ADDED Requirements

### Requirement: Project setup scripts reject incomplete canonical IDs
The system SHALL prevent GitHub Project setup and ID export scripts from reporting success when any canonical Project field or option ID required by the GitHub Kanban workflow is missing.

#### Scenario: Existing Priority field is missing canonical options
- **WHEN** `scripts/setup-github-project.sh` finds an existing `Priority` field
- **AND** one or more of `P0`, `P1`, or `P2` option IDs cannot be resolved
- **THEN** the script SHALL exit non-zero before printing shell export commands
- **AND** the script SHALL NOT update `docs/reference/project-board.md` with blank Priority option IDs

#### Scenario: Project ID export is incomplete
- **WHEN** `scripts/setup-project-ids.sh` resolves the selected Project
- **AND** any required Status or Priority field or option ID is empty
- **THEN** the script SHALL exit non-zero before printing the shell export block
- **AND** the error output SHALL identify that canonical Status/Priority fields or options are incomplete

### Requirement: Go and Node provider boundary documentation is explicit
The system SHALL document intentional differences between Go delegate runtime environment allowlisting and Node wrapper provider authentication or process execution behavior.

#### Scenario: GOOGLE_API_KEY appears in Node auth sources but not Go allowlist
- **WHEN** `docs/contract/go-node-boundary.md` lists Node Gemini auth sources
- **THEN** the document SHALL explain that `GOOGLE_API_KEY` is accepted by the Node wrapper auth fast path
- **AND** the document SHALL explain that the Go delegate runtime allowlist intentionally does not pass `GOOGLE_API_KEY`
- **AND** the document SHALL identify `GEMINI_API_KEY` as the Go delegate runtime headless Gemini key

#### Scenario: Node provider binary handling is described
- **WHEN** the document compares Go and Node provider interfaces
- **THEN** the Node.js binary handling row SHALL describe the actual provider implementation behavior
- **AND** the wording SHALL NOT imply an `IProvider` binary lookup member that does not exist

### Requirement: Provider version probes distinguish process success from version text
The system SHALL treat a successful provider `--version` process as readiness evidence even if the version text is absent from stdout.

#### Scenario: Version output appears on stderr
- **WHEN** a provider CLI exits 0 for `--version`
- **AND** stdout is empty
- **AND** stderr contains non-empty version text
- **THEN** provider readiness fallback SHALL succeed
- **AND** the reported version text SHALL use the first non-empty stderr line

#### Scenario: Version probe exits successfully without text
- **WHEN** a provider CLI exits 0 for `--version`
- **AND** stdout and stderr contain no usable version text
- **THEN** provider readiness fallback SHALL succeed
- **AND** the provider SHALL NOT be reported as missing or unauthenticated only because version text is empty

### Requirement: Sync duplicate cleanup is idempotent within one run
The system SHALL prevent `aco sync --clean-duplicates` from recreating a duplicate target path that it cleaned earlier in the same sync run.

#### Scenario: Cleaned target is also present in planned outputs
- **WHEN** duplicate cleanup removes a target path from disk
- **AND** the same target path exists in the current sync plan outputs as `created` or `updated`
- **THEN** the write phase SHALL NOT copy that target path again during the same run
- **AND** the final manifest SHALL NOT retain that target path as an ACO-owned generated target

### Requirement: Skill directory hashes include relative paths and raw bytes
The system SHALL compute skill directory hashes from both each file's relative path and raw byte content.

#### Scenario: File rename changes directory hash
- **WHEN** a skill directory contains a file with unchanged byte content
- **AND** that file is renamed or moved to a different relative path
- **THEN** the skill directory hash SHALL change
- **AND** `aco sync` SHALL plan an update instead of treating the target as skipped

#### Scenario: Non-UTF-8 byte differences change directory hash
- **WHEN** two skill directory files contain different raw bytes that cannot be safely represented as UTF-8 text
- **THEN** the skill directory hash SHALL reflect the byte difference
- **AND** `aco sync` SHALL NOT collapse those files into the same text-normalized hash input

### Requirement: Review follow-up completion includes original thread closure
The system SHALL complete issue #85 by updating each original unresolved review thread with a concise result and resolving it when the fix or already-fixed confirmation is complete.

#### Scenario: Review thread required a new change
- **WHEN** a review thread from PR #70, #76, #77, #83, or #84 is fixed by the #85 branch
- **THEN** the thread SHALL receive a reply summarizing the change and validation
- **AND** the thread SHALL be marked resolved

#### Scenario: Review thread was already fixed on current main
- **WHEN** a review thread's requested behavior is already present on current `origin/main`
- **THEN** the thread SHALL receive a reply identifying the current-main evidence
- **AND** the thread SHALL be marked resolved without redundant code churn

### Requirement: Local reference checkout is ignored
The repository SHALL ignore local `reference/` checkouts used for external source inspection.

#### Scenario: Reference repository is present locally
- **WHEN** a developer has a local `reference/` directory in the repository root
- **THEN** Git SHALL treat `reference/` as ignored repository-local workspace state
- **AND** the directory SHALL NOT appear as untracked work in normal status output after the ignore rule is present
