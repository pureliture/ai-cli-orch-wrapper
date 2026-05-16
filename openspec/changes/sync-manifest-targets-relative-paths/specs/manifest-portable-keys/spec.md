## ADDED Requirements

### Requirement: Manifest target keys stored as repo-relative paths
The sync engine SHALL store `targetHashes` and `targets` keys in `.aco/sync-manifest.json` as repo-relative POSIX paths (e.g., `AGENTS.md`, `.agents/skills/foo/SKILL.md`) rather than absolute filesystem paths.

#### Scenario: New manifest written after sync
- **WHEN** `aco sync` completes successfully
- **THEN** every key in `targetHashes` and `targets` within `.aco/sync-manifest.json` MUST be a relative path with no leading `/`

#### Scenario: Consistent check result across checkout locations
- **WHEN** `.aco/sync-manifest.json` was written in one checkout location and `aco sync --check` is run from a different checkout location
- **THEN** the command MUST exit with code 0 (no drift) when no source files have changed

### Requirement: Relative manifest keys resolved to absolute paths during sync execution
The sync engine SHALL internally resolve relative manifest keys back to absolute paths when comparing against in-memory `SyncOutput.targetPath` values during conflict detection, action determination, and cleanup.

#### Scenario: Conflict detection uses correct absolute path
- **WHEN** an existing manifest has relative target keys and a new sync plan is computed
- **THEN** conflict detection MUST correctly match each `SyncOutput.targetPath` (absolute) to its manifest record by resolving the relative key against `repoRoot`

#### Scenario: Cleanup deletes correct manifest entries
- **WHEN** stale manifest entries are cleaned (owned or forced cleanup)
- **THEN** `delete plan.manifest.targets[key]` MUST use the same relative-path key format as what was stored

### Requirement: Automatic migration of legacy absolute-path manifests
The `readManifest` function SHALL detect existing manifests whose `targetHashes`/`targets` keys are absolute paths and transparently convert them to repo-relative paths.

#### Scenario: Legacy absolute-path manifest read on first run after upgrade
- **WHEN** `.aco/sync-manifest.json` contains absolute-path keys (e.g., `/Users/alice/project/AGENTS.md`)
- **THEN** `readManifest` MUST return a manifest with all target keys converted to relative paths (e.g., `AGENTS.md`) before returning to callers

#### Scenario: Already-relative manifest unchanged by migration
- **WHEN** `.aco/sync-manifest.json` already contains relative-path keys
- **THEN** `readManifest` MUST return the manifest without modification to any key
