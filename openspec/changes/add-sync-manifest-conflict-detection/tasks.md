## 1. Conflict Planning Tests

- [x] 1.1 Add a sync test fixture that creates a manifest-owned target, records its generated hash, then manually edits the target before the next sync.
- [x] 1.2 Assert that normal `runSync` detects the edited target as a conflict and throws before overwriting the file.
- [x] 1.3 Assert that `runSync` in check mode detects the same conflict, exits through the check failure path, and does not write target files or manifest updates.
- [x] 1.4 Assert that missing manifest-owned targets are recreated instead of marked as conflicts.

## 2. Sync Plan Conflict Detection

- [x] 2.1 Add current target hash calculation for planned outputs that have existing manifest target hashes.
- [x] 2.2 Mark outputs as `conflict` when the current disk hash differs from `existingManifest.targetHashes[targetPath]`.
- [x] 2.3 Preserve existing `created`, `updated`, and `skipped` actions for non-drifted outputs.
- [x] 2.4 Ensure planning does not write target files before conflict decisions are complete.

## 3. CLI Behavior

- [x] 3.1 Ensure `aco sync` without `--force` exits non-zero when conflicts exist and includes conflicting paths in the error.
- [x] 3.2 Ensure the conflict error advises the user to run `aco sync --force` to overwrite manifest-owned targets.
- [x] 3.3 Ensure `aco sync --force` writes generated outputs over conflicts and refreshes manifest target hashes.
- [x] 3.4 Ensure `aco sync --check` reports conflicts as stale state and exits non-zero without writes.

## 4. Verification

- [x] 4.1 Run `npm --workspace packages/wrapper test`.
- [x] 4.2 Run `npm --workspace packages/wrapper run typecheck`.
- [x] 4.3 Manually inspect `aco sync` error text in the conflict test path or CLI output fixture for actionable messaging.
