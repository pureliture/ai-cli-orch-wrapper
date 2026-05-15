## Context

Context sync has two different questions:

1. Are generated targets current relative to source files?
2. Does the manifest describe the current checkout in a portable way?

The current absolute-path manifest blends these concerns. A clone-safe manifest should use stable repo-relative keys while still accepting old manifests for migration.

## Goals / Non-Goals

**Goals:**

- Store source and target manifest paths relative to repo root where possible.
- Read legacy absolute-path manifests without data loss.
- Migrate legacy records to relative keys on write.
- Keep conflict detection and ownership semantics intact.
- Add tests that simulate checking the same repo content from a different checkout path.

**Non-Goals:**

- No broad rewrite of the sync engine.
- No change to which files are generated.
- No change to duplicate detection policy beyond path-key normalization.
- No automatic deletion of user-modified generated targets.

## Data Model Direction

Current manifest shape uses absolute path keys:

```json
{
  "sourceHashes": {
    "/Users/name/project/CLAUDE.md": "..."
  },
  "targetHashes": {
    "/Users/name/project/AGENTS.md": "..."
  },
  "targets": {
    "/Users/name/project/AGENTS.md": {
      "owner": "aco",
      "kind": "config"
    }
  }
}
```

Portable manifest shape should use repo-relative keys:

```json
{
  "version": "3",
  "pathMode": "repo-relative",
  "sourceHashes": {
    "CLAUDE.md": "..."
  },
  "targetHashes": {
    "AGENTS.md": "..."
  },
  "targets": {
    "AGENTS.md": {
      "owner": "aco",
      "kind": "config"
    }
  }
}
```

If a record needs to reference an external path, it should be explicitly marked rather than silently stored as a normal repo target.

## Decisions

1. **Introduce manifest version 3**
   - Option A: Keep version 2 and silently change key semantics.
   - Option B: Introduce version 3 with `pathMode: repo-relative`.
   - Decision: choose B. Readers need to distinguish legacy absolute-path manifests from portable manifests.

2. **Normalize at the manifest boundary**
   - Option A: Convert paths throughout sync engine internals.
   - Option B: Keep internal absolute paths where useful, but serialize and compare manifest keys through a normalization helper.
   - Decision: choose B. This minimizes behavioral churn.

3. **Doctor reports portability separately**
   - Option A: Treat non-portable paths as ordinary sync drift.
   - Option B: Report `manifest portability` separately from content drift.
   - Decision: choose B. The fix and risk are different.

4. **Migration is explicit but low-friction**
   - Option A: Fail until a manual migration command is run.
   - Option B: `aco sync --check` reports legacy path mode; `aco sync` rewrites to portable manifest if content is otherwise valid.
   - Decision: choose B, unless implementation discovers a compatibility risk.

## Risks / Trade-offs

- [Risk] Key normalization breaks conflict detection. [Mitigation] Add tests for user-modified target drift under both legacy and v3 manifests.
- [Risk] Migration hides real content drift. [Mitigation] Keep portability warning distinct from source/target hash mismatch.
- [Risk] CI and local worktrees disagree on path separators. [Mitigation] Normalize keys to POSIX-style repo-relative paths in manifest JSON.
- [Risk] Existing consumers expect absolute keys. [Mitigation] Preserve read compatibility and document version 3.

## Validation Strategy

- Fixture with legacy absolute manifest copied into a new checkout path.
- Fixture with v3 relative manifest in two different checkout paths.
- Conflict detection test where generated target is manually edited.
- Check mode test where only path portability differs.
- `aco doctor` output test for legacy path mode.

## Open Questions

- Should v3 migration happen on any `aco sync`, or only with `--force`/new `--migrate-manifest`?
- Should `.aco/sync-manifest.json` remain committed after v3, or should generated target verification move to CI-only regeneration?
- Should manifest source paths include `./` prefixes or plain relative paths?
