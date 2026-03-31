---
phase: 04-canonical-command-surface
verified: 2026-03-31T02:40:43Z
status: passed
score: 4/4 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/4
  gaps_closed:
    - "Phase 04 planning requirements and milestone docs describe the shipped canonical command surface consistently."
  gaps_remaining: []
  regressions: []
---

# Phase 04: canonical-command-surface Verification Report

**Phase Goal:** Users can discover, invoke, and recover to the `aco` command without ambiguity while `.wrapper*` runtime paths stay intact for the next phase.
**Verified:** 2026-03-31T02:40:43Z
**Status:** passed
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can invoke the installed CLI with the canonical `aco` command. | ✓ VERIFIED | Preserved runtime evidence from the earlier Phase 04 verification: `package.json` maps `aco` to `dist/cli.js`, and `aco help` exited 0 with `Usage: aco <command>`. |
| 2 | Help, usage, version, and ordinary command-error output identify the tool as `aco`. | ✓ VERIFIED | Preserved runtime evidence: `aco help`, `node dist/cli.js typo-command`, and the prior version check all emitted `aco`-branded output only. |
| 3 | Stale `wrapper` entrypaths and bare invocation recover directly to `aco`. | ✓ VERIFIED | Preserved runtime evidence: `wrapper help` exited 1 with `Use aco help.`, `node dist/cli.js typo-command` exited 1 with `Use aco help.`, and bare `node dist/cli.js` exited 1 with `Use aco help.`. |
| 4 | The `.wrapper*` runtime contract remains intact while the public command surface flips to `aco`. | ✓ VERIFIED | Re-verified by documentation alignment plus unchanged runtime surface: Phase 05 wording in `ROADMAP.md` and active milestone text in `PROJECT.md` both preserve `.wrapper.json`, `.wrapper/`, and `wrapper.lock` under the `aco` public command. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `.planning/REQUIREMENTS.md` | Phase 04 and Phase 05 requirement IDs use `aco` for the public command surface | ✓ VERIFIED | `CMD-01`, `CMD-02`, `WRAP-03`, `CMD-03`, `WRAP-01`, and `WRAP-02` now all reference `aco` where appropriate while preserving `.wrapper*` runtime paths. |
| `.planning/PROJECT.md` | Active/current milestone text describes `aco` as canonical and `.wrapper*` as the preserved runtime contract | ✓ VERIFIED | Current milestone goal, active requirements, milestone status, and rename context now match the shipped selective cutover. |
| `.planning/ROADMAP.md` | Phase 05 wording stays consistent with the public `aco` command surface and preserved `.wrapper*` contract | ✓ VERIFIED | Phase 05 overview, goal, and success criteria now describe `aco setup`, `aco` alias/workflow entrypoints, and `.wrapper*` persistence. |
| `package.json` | Public npm bin surface remains `aco` | ✓ VERIFIED | No source/package changes are present in the current worktree diff; earlier runtime verification for `aco` remains applicable. |
| `src/cli.ts` / `src/cli-surface.ts` | Canonical `aco` help/error/recovery surface remains the implemented runtime | ✓ VERIFIED | No runtime code changes were introduced after the prior verification; only `.planning` files changed in the current diff. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `.planning/REQUIREMENTS.md` | Phase 04 | traceability table | ✓ WIRED | `CMD-01`, `CMD-02`, and `WRAP-03` still trace to Phase 04, now with `aco` wording that matches the implementation. |
| `.planning/REQUIREMENTS.md` | Phase 05 | traceability table | ✓ WIRED | `CMD-03`, `WRAP-01`, and `WRAP-02` remain mapped to Phase 05 and now describe the future runtime-contract work under the `aco` command surface. |
| `.planning/PROJECT.md` | `.planning/ROADMAP.md` | active milestone goal and target features | ✓ WIRED | Both docs describe `aco` as canonical while explicitly preserving `.wrapper.json`, `.wrapper/`, and `wrapper.lock` through Phase 05. |
| `.planning/ROADMAP.md` | shipped CLI surface | Phase 05 goal and success criteria | ✓ WIRED | Phase 05 now consistently frames the next work as keeping the existing `.wrapper*` repo-local contract under the `aco` public command. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `PROJECT.md` active milestone text | canonical command / runtime-contract narrative | Updated project planning document | Yes | ✓ FLOWING |
| `ROADMAP.md` Phase 05 goal and success criteria | future-phase wording for `CMD-03`, `WRAP-01`, `WRAP-02` | Updated roadmap document | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Build succeeds | `npm run build` | exit 0 | ✓ PASS |
| Prior-phase regression gate passes | prior phase regression gate | passed | ✓ PASS |
| Full automated suite passes | `npm test` | 56/56 passing | ✓ PASS |
| Typecheck/lint gate passes | `npm run lint` | exit 0 | ✓ PASS |
| Canonical help output works | `aco help` | exit 0; printed `Usage: aco <command>` | ✓ PASS |
| Stale legacy command recovers to `aco` | `wrapper help` | exit 1; printed `Use aco help.` | ✓ PASS |
| Ordinary unknown command recovers to `aco` | `node dist/cli.js typo-command` | exit 1; printed `Use aco help.` | ✓ PASS |
| Bare invocation gives direct recovery | `node dist/cli.js` | exit 1; printed `Use aco help.` | ✓ PASS |

Re-verification note: the current worktree diff is limited to `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/config.json`. No source, test, or package files changed after the earlier runtime verification in this session, so the runtime evidence remains valid.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `CMD-01` | `04-01-PLAN.md` | User can invoke the installed CLI through the canonical `aco` command on a supported machine | ✓ SATISFIED | Requirement wording now matches the shipped `aco` bin surface and earlier `aco help` verification. |
| `CMD-02` | `04-01-PLAN.md`, `04-02-PLAN.md` | User sees `aco` in help, usage, version, and command error output instead of legacy command labels | ✓ SATISFIED | Requirement wording now matches the shipped help/error surface validated in the earlier Phase 04 runtime checks. |
| `WRAP-03` | `04-02-PLAN.md` | User receives direct remediation telling them to use `aco` when they hit a stale command invocation or packaging assumption | ✓ SATISFIED | Requirement wording now matches the verified `wrapper help` and bare-entry remediation output. |
| `CMD-03` | Phase 05 roadmap scope | Built-in subcommands continue to override alias names after the `aco` command surface is consolidated | ✓ ALIGNED | Requirement text now correctly frames the pending behavior under `aco`; implementation remains scheduled for Phase 05. |
| `WRAP-01` | Phase 05 roadmap scope | User can run `aco setup` and get repo-local config initialized through the `.wrapper.json` contract without manual renaming | ✓ ALIGNED | Requirement text now correctly preserves `.wrapper.json` while using `aco setup` as the public entrypoint. |
| `WRAP-02` | Phase 05 roadmap scope | User can run alias and workflow entrypoints through `aco` while artifacts continue to be stored under the expected `.wrapper/` paths | ✓ ALIGNED | Requirement text now correctly preserves `.wrapper/` under the `aco` public command. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No blocker anti-patterns found in the re-verified planning docs. | ℹ️ Info | The prior drift is closed; the updated wording is consistent across requirements, project state, and roadmap scope. |

### Human Verification Required

None. The re-verification scope was documentation alignment, and the previously established runtime behaviors remain covered by same-session command evidence with no runtime-file changes afterward.

### Gaps Summary

The only prior gap is closed. `REQUIREMENTS.md` now aligns `CMD-01`, `CMD-02`, `WRAP-03`, `CMD-03`, `WRAP-01`, and `WRAP-02` with the shipped `aco` public command surface while keeping `.wrapper*` as the repo-local runtime contract. `PROJECT.md` now presents the active/current milestone as `aco`-canonical with `.wrapper*` preserved, and `ROADMAP.md` Phase 05 now uses wording consistent with that selective cutover.

Phase 04 remains runtime-complete, and the planning-doc traceability now matches the shipped behavior.

---

_Verified: 2026-03-31T02:40:43Z_
_Verifier: Claude (gsd-verifier)_
