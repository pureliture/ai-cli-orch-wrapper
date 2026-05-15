## 1. Manifest model

- [ ] 1.1 Add manifest version 3 with `pathMode: repo-relative`.
- [ ] 1.2 Add helpers for converting repo paths to stable POSIX-style relative manifest keys.
- [ ] 1.3 Preserve read compatibility for version 2 absolute-path manifests.

## 2. Sync engine behavior

- [ ] 2.1 Update manifest read/write paths to use normalized keys.
- [ ] 2.2 Ensure conflict detection still compares actual current-checkout target files.
- [ ] 2.3 Ensure missing manifest-owned targets are recreated as before.
- [ ] 2.4 Define migration behavior for legacy manifests and document whether `--force` is required.

## 3. Diagnostics and docs

- [ ] 3.1 Update `aco doctor` to report manifest portability separately from sync content drift.
- [ ] 3.2 Update `docs/reference/context-sync.md` with v3 path semantics.
- [ ] 3.3 Update runbook troubleshooting for clones, worktrees, and CI checkouts.
- [ ] 3.4 Migrate committed `.aco/sync-manifest.json` only after tests prove v3 behavior.

## 4. Verification

- [ ] 4.1 Add tests for v2 absolute manifest migration.
- [ ] 4.2 Add tests for v3 manifest verification from a different checkout path.
- [ ] 4.3 Add tests for user-modified generated target conflicts under v3.
- [ ] 4.4 Run `openspec validate make-sync-manifest-portable --type change --strict`.
- [ ] 4.5 Run `npm run build`, `npm test --workspace=packages/wrapper`, and targeted sync tests.
