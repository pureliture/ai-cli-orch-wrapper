## Why

Issue #85 consolidates unresolved review threads left on merged PRs #70, #76, #77, #83, and #84. The comments point at a small set of still-actionable hardening gaps across Project setup scripts, Go/Node boundary documentation, provider readiness probes, sync cleanup/hash behavior, and local reference workspace hygiene.

This change creates one bounded follow-up so the fixes can land on current `origin/main`, be tested together, and then be replied to and resolved on the original review threads.

## What Changes

- Harden GitHub Project setup/export scripts so missing canonical Status/Priority fields or option IDs cannot be reported as successful setup output.
- Clarify `docs/contract/go-node-boundary.md` where Go runtime environment allowlisting intentionally differs from Node wrapper auth sources, especially `GOOGLE_API_KEY`, and describe Node provider binary handling in terms of the actual implementation.
- Adjust provider version probing so a successful `--version` process with empty stdout or stderr-only output does not make an otherwise available provider look unauthenticated or missing.
- Complete sync hardening follow-ups from PR #83 and #84:
  - distinguish already-fixed `sync.yaml` handling and cleanup target structure from remaining work;
  - prevent `--clean-duplicates` from recreating cleaned outputs in the same run;
  - make directory hashes sensitive to relative file paths and raw bytes, not only UTF-8 text content.
- Add regression tests for every behavior change that can be exercised locally.
- Reply to and resolve all 11 original unresolved review threads once the relevant fix or "already fixed on main" confirmation is complete.
- Ignore local `reference/` checkouts so external reference clones do not appear as repository work.

## Capabilities

### New Capabilities

- `review-followup-hardening`: Batch hardening contract for #85 review follow-up work across PM scripts, boundary docs, provider readiness probing, sync duplicate cleanup/hash behavior, review thread closure, and local reference ignore rules.

### Modified Capabilities

- None. This follow-up tightens implementation and documentation around already-planned surfaces rather than introducing a new public CLI command or changing a released CLI contract.

## Impact

- Affected scripts: `scripts/setup-github-project.sh`, `scripts/setup-project-ids.sh`.
- Affected wrapper code: `packages/wrapper/src/util/read-version.ts`, `packages/wrapper/src/providers/*`, `packages/wrapper/src/sync/sync-engine.ts`, `packages/wrapper/src/sync/skill-transform.ts`, and related sync/provider tests.
- Affected docs: `docs/contract/go-node-boundary.md`, `README.md`.
- Affected validation wiring: `package.json`, `.github/workflows/ci.yml`, `test/scripts/project-id-validation.test.sh`.
- Affected repository hygiene: `.gitignore` gains `reference/`.
- External side effects after implementation: the original review threads on PR #70, #76, #77, #83, and #84 receive replies and resolved-state updates.
- No dependency or lockfile change is expected.
