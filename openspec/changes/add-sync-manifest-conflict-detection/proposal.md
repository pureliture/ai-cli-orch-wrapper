## Why

`aco sync` tracks generated targets in a manifest, but it currently treats manifest ownership as permission to rewrite those targets. If a user manually edits a manifest-owned file, a later sync can overwrite that work without a conflict signal.

This change adds drift-aware conflict detection so generated context files remain safe to refresh while preserving user edits unless the user explicitly chooses `--force`.

## What Changes

- Detect when a manifest-owned target file's current disk hash no longer matches the hash recorded in `.aco/sync-manifest.json`.
- Mark drifted manifest-owned outputs as `conflict` instead of silently treating them as ordinary updates.
- Make `aco sync` fail with a clear conflict message when conflicts exist and `--force` is not provided.
- Allow `aco sync --force` to overwrite drifted manifest-owned outputs and refresh the manifest.
- Make `aco sync --check` detect drifted targets and exit non-zero with actionable output.

## Capabilities

### New Capabilities

- `context-sync-conflict-detection`: Covers conflict detection and force-overwrite behavior for manifest-owned `aco sync` targets.

### Modified Capabilities

None.

## Impact

- Affected code: `packages/wrapper/src/sync/sync-engine.ts`, manifest handling helpers, sync CLI output, and related tests.
- Affected CLI behavior: `aco sync`, `aco sync --check`, and `aco sync --force`.
- No dependency changes expected.
