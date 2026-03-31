---
phase: 04-canonical-command-surface
verified: 2026-03-31T08:51:59Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed:
    - "04-03 cleanup now proves the real machine surface is `aco`-only: `/opt/homebrew/bin/aco` resolves to this package's `dist/cli.js` and `/opt/homebrew/bin/wrapper` is absent."
  gaps_remaining: []
  regressions: []
---

# Phase 04: Canonical Command Surface Verification Report

**Phase Goal:** Users can discover, invoke, and recover to the `aco` command without ambiguity while `.wrapper*` runtime paths stay intact for the next phase.
**Verified:** 2026-03-31T08:51:59Z
**Status:** passed
**Re-verification:** Yes — refreshed after 04-03 gap closure with fresh code and machine-state checks

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can invoke the installed CLI with the canonical `aco` command on this machine. | ✓ VERIFIED | `package.json` exposes only `"aco": "dist/cli.js"`. `which aco` resolves to `/opt/homebrew/bin/aco`, and `fs.realpathSync('/opt/homebrew/bin/aco')` resolves to `/Users/pureliture/ai-cli-orch-wrapper/dist/cli.js`. |
| 2 | Help, usage, version, and ordinary command-error output identify the tool as `aco`. | ✓ VERIFIED | `aco help` prints `Usage: aco <command>`, `aco version` prints `aco v0.2.0`, and `node dist/cli.js typo-command` exits 1 with `Use aco help.` and no legacy branding. |
| 3 | Stale invocation paths recover directly to `aco` instead of behaving like supported `wrapper` commands. | ✓ VERIFIED | `test/canonical-command-surface.test.ts` passes symlink-based stale-entry checks for `wrapper help` → `Use aco help.` and `wrapper setup` → `Use aco setup.`. Bare `node dist/cli.js` exits 1 with `Use aco help.`. |
| 4 | Install/relink cleanup removes only package-owned stale `wrapper` shims and leaves unrelated targets alone. | ✓ VERIFIED | `test/install-state-cleanup.test.ts` passes the owned-shim removal, canonical `aco` preservation, unrelated-wrapper skip, and no-op cases. On the real machine, `npm run cleanup:legacy-bin` reports `found nothing: no legacy wrapper shim at /opt/homebrew/bin`, and `/opt/homebrew/bin/wrapper` does not exist. |
| 5 | The `.wrapper*` runtime contract stays intact while the public command surface flips to `aco`, and maintainers have one explicit refresh path. | ✓ VERIFIED | Help/setup/docs still reference `.wrapper.json` and `.wrapper/workflows`; `src/commands/setup.ts` preserves `.wrapper.json`; `README.md` documents `npm run cleanup:legacy-bin` then `npm link` as the explicit refresh path. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `package.json` | Public npm bin is `aco` only; cleanup script is wired for manual and install-time refresh | ✓ VERIFIED | Contains `"aco": "dist/cli.js"`, `cleanup:legacy-bin`, and `postinstall`; no `wrapper` bin key remains. |
| `src/cli-surface.ts` | Centralized canonical command constants plus help/version/recovery formatters | ✓ VERIFIED | Exports `CANONICAL_COMMAND`, `LEGACY_COMMAND`, `getPackageVersion`, `formatHelp`, `formatVersionLine`, `formatUnknownCommand`, `formatUseCanonicalCommand`, and `selectRecoveryNextStep`. |
| `src/cli.ts` | CLI entrypoint is wired to canonical surface helpers and stale-entry remediation | ✓ VERIFIED | Imports `./cli-surface.js`, checks `path.basename(process.argv[1] ?? '')`, handles zero-arg recovery, and routes unknown commands through `formatUnknownCommand`. |
| `src/commands/setup.ts` | Setup wording is `aco`-branded while `.wrapper.json` remains literal | ✓ VERIFIED | Managed comments use `aco setup`; file path and scaffold contract remain `.wrapper.json`. |
| `scripts/cleanup-legacy-bin.mjs` | Ownership-aware global-bin cleanup removes only package-owned stale `wrapper` shims | ✓ VERIFIED | Reads the effective package root and prefix, validates the `aco`-only bin contract, compares resolved targets, and removes only proven package-owned legacy shims. |
| `README.md` | Public quick-start and refresh guidance use `aco` and document the cleanup path | ✓ VERIFIED | Quick start uses `aco help` / `aco version`; refresh guidance documents `npm run cleanup:legacy-bin` followed by `npm link`. |
| `test/canonical-command-surface.test.ts` | Regression coverage locks canonical `aco` help/version/error/stale-remediation behavior | ✓ VERIFIED | Covers package bin mapping, help/version output, stale `wrapper` symlink remediation, bare invocation, unknown command recovery, README guidance, and built-in alias conflicts. |
| `test/install-state-cleanup.test.ts` | Regression coverage locks safe stale-bin cleanup behavior | ✓ VERIFIED | Covers owned-wrapper removal, unrelated-wrapper skip, canonical `aco` preservation, and no-op behavior when no legacy shim exists. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `package.json` | `dist/cli.js` | npm `bin` mapping | ✓ WIRED | `package.json#bin` maps only `aco` to `dist/cli.js`; machine `aco` symlink resolves to the same target. |
| `src/cli.ts` | `src/cli-surface.ts` | centralized help/version/error formatting | ✓ WIRED | `src/cli.ts` imports the canonical helpers and uses them for help, version, stale recovery, and unknown-command output. |
| `src/cli.ts` | `process.argv[1]` | `path.basename(process.argv[1] ?? '')` legacy entry detection | ✓ WIRED | The runtime classification branch fails fast only when the invoked basename is `wrapper`, preserving direct `node dist/cli.js` usage for development/tests. |
| `src/commands/setup.ts` | `.wrapper.json` | managed comment text and scaffold path | ✓ WIRED | Setup comments and created file path both preserve `.wrapper.json` while user-facing wording uses `aco`. |
| `package.json` | `scripts/cleanup-legacy-bin.mjs` | `cleanup:legacy-bin` and `postinstall` scripts | ✓ WIRED | The cleanup script is reachable both explicitly and via install lifecycle wiring. |
| `scripts/cleanup-legacy-bin.mjs` | global npm bin directory | prefix resolution plus ownership check | ✓ WIRED | Script resolves the effective prefix, computes the global bin dir, inspects `wrapper`/`aco` targets, and removes only proven package-owned legacy shims. |
| `README.md` | package refresh flow | maintainer remediation guidance | ✓ WIRED | README points maintainers to the same `cleanup:legacy-bin` and `npm link` path that was verified on the machine. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `src/cli-surface.ts` | displayed version string | runtime read of repo-root `package.json` via `getPackageVersion()` | Yes | ✓ FLOWING |
| `scripts/cleanup-legacy-bin.mjs` | `packageCliTarget`, `acoTarget`, `wrapperTarget` ownership comparison | realpaths from current package root and global npm bin | Yes | ✓ FLOWING |
| `/opt/homebrew/bin/aco` machine state | canonical executable target | actual symlink target on disk | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Build succeeds | `npm run build` | exit 0 | ✓ PASS |
| Phase 04 targeted regression suite passes | `node --test test/install-state-cleanup.test.ts test/canonical-command-surface.test.ts test/workflow-cli.test.ts test/setup.test.ts` | 23/23 passing | ✓ PASS |
| Typecheck/lint gate passes | `npm run lint` | exit 0 | ✓ PASS |
| Package can be relinked | `npm link` | exit 0 | ✓ PASS |
| Explicit stale-bin cleanup path works | `npm run cleanup:legacy-bin` | exit 0; `found nothing: no legacy wrapper shim at /opt/homebrew/bin` | ✓ PASS |
| Canonical command exists on machine | `which aco` | `/opt/homebrew/bin/aco` | ✓ PASS |
| Legacy command no longer exists on machine | `which wrapper` | `wrapper not found` | ✓ PASS |
| Canonical help works through the linked executable | `aco help` | exit 0; printed `Usage: aco <command>` | ✓ PASS |
| Canonical version works through the linked executable | `aco version` | exit 0; printed `aco v0.2.0` | ✓ PASS |
| Ordinary unknown command recovers to `aco` | `node dist/cli.js typo-command` | exit 1; printed `Use aco help.` | ✓ PASS |
| Bare invocation gives one direct recovery step | `node dist/cli.js` | exit 1; printed `Use aco help.` | ✓ PASS |
| Full repo suite state | `npm test` | fails outside Phase 04 scope: untracked `test-url-resolution.ts` imports missing `src/orchestration/workflow-runner.js`; `test/cao-client.test.ts` also times out on idle-terminal completion behavior | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `CMD-01` | `04-01-PLAN.md`, `04-03-PLAN.md` | User can invoke the installed CLI through the canonical `aco` command on a supported machine | ✓ SATISFIED | `package.json` is `aco`-only; `/opt/homebrew/bin/aco` resolves to this package's `dist/cli.js`; `aco help` and `aco version` both work. |
| `CMD-02` | `04-01-PLAN.md`, `04-02-PLAN.md` | User sees `aco` in help, usage, version, and command error output instead of legacy command labels | ✓ SATISFIED | Help/version/unknown-command output all use `aco`; setup-managed wording also uses `aco` while preserving deferred `.wrapper*` paths. |
| `WRAP-03` | `04-02-PLAN.md`, `04-03-PLAN.md` | User receives direct remediation telling them to use `aco` when they hit a stale command invocation or packaging assumption | ✓ SATISFIED | Stale `wrapper` symlink tests pass; bare invocation recovers to `aco`; cleanup removes or skips legacy shims safely; README documents the explicit refresh path. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No Phase 04 blocker stubs, TODO markers, or orphaned command-surface artifacts found in the verified files. | ℹ️ Info | The phase artifacts are substantive and wired. |
| `test-url-resolution.ts` | 1 | Untracked repo-level test imports missing `./src/orchestration/workflow-runner.js` | ⚠️ Warning | Breaks `npm test`, but this file is untracked and outside the Phase 04 write scope. |
| `test/cao-client.test.ts` | 210 | Existing orchestration-client idle-terminal assertion times out during full-suite execution | ⚠️ Warning | Breaks `npm test`, but Phase 04 did not modify orchestration client files. |

### Human Verification Required

None. The phase goal and 04-03 gap closure were verified with direct machine-state checks plus targeted automated coverage.

### Gaps Summary

No Phase 04 gaps remain. The canonical public surface is `aco`, stale invocation recovery is direct and consistent, the explicit cleanup path is wired and documented, and the real global npm bin state is now `aco`-only on this machine.

The only red checks observed are repository-level test debts outside the Phase 04 command-surface scope. They do not contradict the verified Phase 04 goal, but they should be addressed separately before treating the entire repository as fully green.

---

_Verified: 2026-03-31T08:51:59Z_
_Verifier: Claude (gsd-verifier)_
