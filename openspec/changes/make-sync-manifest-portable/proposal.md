## Why

`.aco/sync-manifest.json` currently records absolute paths from the checkout where `aco sync` last ran. When the repo is cloned, archived, or evaluated in a different path, the manifest can point at another checkout. `aco doctor` can detect this, but the committed manifest itself is not portable.

That undermines the gray box boundary for context sync. A generated target should be verifiable from the current repo, not from the path where another maintainer generated it.

## What Changes

- Change sync manifest records to use repo-relative paths where possible.
- Add compatibility handling for existing absolute-path manifests.
- Add migration behavior so a local sync can rewrite the manifest into portable form.
- Update `aco doctor` and `aco sync --check` messaging to distinguish stale content drift from non-portable path metadata.

## Capabilities

### New Capabilities

- `sync-manifest-portability`: Context sync manifests can be committed and verified across clones, worktrees, and CI checkouts without embedding maintainer-specific absolute paths.

### Modified Capabilities

- `aco sync --check` and `aco doctor` should report portable-manifest status separately from content drift.
- Manifest read/write code should remain backward compatible with version 2 absolute-path records.

## Impact

- `packages/wrapper/src/sync/manifest.ts`: path normalization, read/write migration, version handling.
- `packages/wrapper/src/sync/sync-engine.ts`: compare current repo paths against manifest records through normalized keys.
- `packages/wrapper/src/commands/doctor.ts`: improve diagnostics for portability versus drift.
- `.aco/sync-manifest.json`: migrate to portable paths after implementation.
- Tests: add clone/worktree-path fixtures and legacy manifest migration cases.
- Docs: update `docs/reference/context-sync.md` and troubleshooting/runbook guidance.

## Non-Goals

- Do not remove manifest ownership tracking.
- Do not change generated target content semantics.
- Do not make `aco sync --force` silently overwrite user drift.
- Do not solve unrelated duplicate skill cleanup behavior.
