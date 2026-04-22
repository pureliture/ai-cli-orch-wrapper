## Context

`aco sync` generates cross-tool context outputs such as root managed blocks, generated agent definitions, copied skill directories, and hook configuration. The sync manifest records source hashes and target hashes so later runs can distinguish current generated outputs from stale generated outputs.

The missing safety boundary is local target drift. A target can be manifest-owned and still be manually edited after the previous sync. In that case the current disk hash no longer matches the manifest's recorded target hash, and a normal sync must treat that as a user-owned conflict unless `--force` is explicit.

Issue #56 comes from PR #55 review feedback on `packages/wrapper/src/sync/sync-engine.ts`, where the current plan computes new output hashes but does not compare existing manifest target hashes against current target file contents before writing.

## Goals / Non-Goals

**Goals:**

- Detect manual edits to manifest-owned generated targets before writing new sync output.
- Report drifted manifest-owned targets as `conflict` outputs in the transform plan.
- Make `aco sync` fail without writing conflicting targets unless `--force` is provided.
- Make `aco sync --check` fail when manifest-owned targets have drifted on disk.
- Keep behavior deterministic and testable with local filesystem fixtures.

**Non-Goals:**

- Do not detect conflicts for targets that are not listed in the existing sync manifest.
- Do not add merge support for user-edited generated files.
- Do not change the manifest schema unless implementation proves it necessary.
- Do not change provider runtime behavior or generated file formats.

## Decisions

1. **Compare current target hash against existing manifest hash before writes**

   For each planned output, if `existingManifest.targetHashes[targetPath]` exists and the target file currently exists, compute the current disk hash and compare it to the manifest hash. A mismatch means the generated target has drifted since the last sync and the output action SHALL become `conflict`.

   Alternative considered: compare only the newly generated hash against the manifest hash. That detects stale generated output, but it does not distinguish ordinary regeneration from user edits.

2. **Run conflict detection in the transform plan layer**

   Conflict status should be assigned while building the `TransformPlan`, before `runSync` decides whether to write or fail. This keeps `--check`, normal sync, and `--force` behavior driven by the same output actions.

   Alternative considered: check conflicts only in `runSync` immediately before writing. That would duplicate logic for `--check` or risk `--check` missing the same conflict.

3. **Let `--force` bypass conflicts but still refresh manifest hashes**

   A conflict means "do not overwrite by default", not "the generated output is invalid." With `--force`, sync should write the generated target and update the manifest to the new generated hash.

   Alternative considered: require users to delete the target or manifest entry manually. That is safer but less ergonomic and inconsistent with the existing `--force` contract.

4. **Treat missing manifest-owned targets as normal recreation, not conflict**

   If a manifest target is missing on disk, sync can recreate it. Missing files do not contain user edits to preserve.

   Alternative considered: treat missing files as conflicts. That would make cleanup or accidental deletion harder to recover from and does not protect actual content.

## Risks / Trade-offs

- **Hashing directories is ambiguous** -> Manifest-owned directory outputs should continue to use the existing directory hash strategy or sync-owned source hash convention consistently; tests should cover whichever representation the current implementation uses.
- **Generated output may be computed before conflict detection** -> The implementation must avoid writing files while planning, or detect conflict before any write for the target.
- **Overly broad conflict detection could block legitimate regeneration** -> Only manifest-owned targets with a current disk hash mismatch should be marked conflict.
- **`--force` could still overwrite user edits** -> This is intentional and must be explicit in CLI guidance and tests.

## Migration Plan

1. Add failing tests for drifted manifest-owned target files.
2. Implement conflict detection in sync planning before writes.
3. Verify normal sync fails, `--check` fails, and `--force` overwrites with refreshed manifest hashes.
4. No data migration is required; existing manifests begin participating in drift detection on the next sync run.

## Open Questions

None.
