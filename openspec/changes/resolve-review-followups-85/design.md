## Context

Issue #85 is a post-merge review-follow-up bundle. The source PRs are already merged, so the implementation must target current `origin/main`, not the historical PR branches.

The unresolved review threads fall into three states:

- Still actionable code or documentation gaps: Project setup/export validation, Go/Node boundary wording, provider version probing, duplicate cleanup output filtering, and directory hashing.
- Already fixed on current main: `loadSyncConfig()` already handles empty/comment-only YAML through `js-yaml`, and duplicate cleanup warnings already carry structured `cleanupTargets`.
- Operational cleanup: the original review threads need concise replies and resolved-state updates after the branch demonstrates either a fix or an already-fixed confirmation.

Local repository state also has `reference/` as a separate cloned reference repository. It should remain available locally, but it should not appear as work in this repository.

## Goals / Non-Goals

**Goals:**

- Land one current-main follow-up branch for issue #85.
- Prevent Project setup scripts from emitting blank or incomplete canonical field IDs as successful setup output.
- Make `docs/contract/go-node-boundary.md` accurately describe the intentional Go runtime versus Node wrapper environment/auth differences.
- Treat successful provider version probes as readiness evidence even when version text is absent from stdout or appears on stderr.
- Keep sync duplicate cleanup idempotent within a single run after cleaning a target path.
- Make skill directory hashing detect relative path changes and binary byte changes.
- Add targeted regression coverage for executable behavior changes.
- Add `reference/` to `.gitignore`.
- Reply to and resolve all 11 original review threads with either the landed fix or already-fixed confirmation.

**Non-Goals:**

- Reopen or rewrite merged PRs #70, #76, #77, #83, or #84.
- Add new GitHub Project fields, labels, or workflow concepts.
- Change provider auth semantics beyond the local `--version` fallback readiness probe.
- Replace the sync manifest format or introduce a new cleanup command.
- Delete local `reference/` data.

## Decisions

### 1. Treat #85 as a current-main repair, not stacked PR cleanup

Implement against the `feat/85-resolve-pending-review-threads-across-prs-70-76-77-83-and-84` branch created from `origin/main`. Review threads tied to behavior that is already fixed on current main should receive a reply explaining the current-main evidence and then be resolved; they should not force redundant code churn.

### 2. Fail fast before printing or writing incomplete Project IDs

Both setup scripts should validate the complete canonical Project field set before printing shell exports or mutating `docs/reference/project-board.md`.

The required set is:

- Project number and Project node ID
- Status field ID and `Backlog`, `Ready`, `In Progress`, `In Review`, `Done` option IDs
- Priority field ID and `P0`, `P1`, `P2` option IDs

If any required value is missing, the scripts should exit non-zero with a concrete diagnostic instead of producing copy-pasteable empty exports.

### 3. Document environment differences as an intentional boundary

The Go runtime passes only allowlisted environment variables to provider processes. The Node wrapper currently invokes provider CLIs through provider implementations and does not apply the Go allowlist to that path.

`GOOGLE_API_KEY` is therefore valid as a Node Gemini auth source but intentionally not listed as a Go delegate runtime allowlist entry. Documentation should state this plainly so users do not interpret it as a typo.

### 4. Preserve version text when available but separate readiness from text presence

`readVersion()` currently returns `undefined` when stdout is empty, even if the process exits successfully. The follow-up should distinguish two facts:

- whether the probe process exited successfully;
- what human-readable version text, if any, was discovered.

The smallest compatible implementation is to let `readVersion()` consider stderr as a fallback source and, if the process exits 0 with no usable text, return a stable non-empty probe-success marker or otherwise expose probe success to callers without making `checkAuth()` fail.

### 5. Remove cleaned duplicate paths from the same run's output plan

During `--clean-duplicates`, any target path removed from disk and manifest state must also be excluded from `plan.outputs` before the write loop. Otherwise a planned `created` or `updated` directory output can recreate the duplicate during the same sync run.

This filtering should be path-based and should not affect unrelated outputs.

### 6. Hash directory layout and bytes, not decoded text only

Skill directory hash inputs should include each file's relative path plus raw bytes. This makes the hash change when:

- a file is renamed while content stays identical;
- two files contain different non-UTF-8 byte sequences that would otherwise be lossy when decoded as UTF-8.

The implementation can hash each file as `relative-path + NUL + bytes` and then hash a sorted list of per-file digests, preserving deterministic output without loading the entire directory into one concatenated string.

## Risks / Trade-offs

| Risk | Mitigation |
| ---- | ---------- |
| Some review threads are already fixed, causing redundant edits | Treat current-main evidence as sufficient and resolve those threads with a reply |
| Setup scripts become too strict for partially configured Projects | Fail-fast diagnostics tell users exactly which canonical field or option is missing |
| Empty version text loses useful display information | Keep actual stdout/stderr version text when available and use probe-success only as a fallback |
| Directory hashing changes can mark existing synced skill targets stale once | Accept one refresh because the new hash is more accurate and safer |
| Cleanup output filtering could remove legitimate planned outputs with the same path | Filter only paths that were actually cleaned in the current duplicate cleanup step |
| Resolving review threads is a live GitHub mutation | Perform it only after tests pass and replies explain the landed change or already-fixed state |

## Migration Plan

1. Update `.gitignore` with `reference/`.
2. Implement and test script validation for Project setup/export IDs.
3. Update boundary documentation and verify it matches Go and Node implementation facts.
4. Implement provider version probe fallback handling with targeted provider or utility tests.
5. Implement sync duplicate cleanup output filtering and directory hash improvements with targeted sync tests.
6. Run focused tests first, then `git diff --check`; run broader wrapper checks if the touched areas warrant it.
7. Reply to and resolve the 11 original review threads.
8. Create the PR for #85 and move the issue/PR Project state through the normal workflow.

Rollback is file-based: revert the branch changes and leave the existing merged PR behavior in place. No data migration or dependency rollback is expected.

## Open Questions

- Should a successful version probe with no output display a generic version such as `unknown`, or should provider status omit the version while still marking `cli-fallback` as ready?
- Should `scripts/setup-github-project.sh` attempt to repair an existing Priority field with missing options, or only fail with a clear diagnostic? The safer first step is fail-fast diagnostics.
