## Overall Assessment

The Phase 05 plan set is directionally solid and mostly aligned to the milestone goal: keep `aco` as the canonical public surface while preserving the `.wrapper*` repo-local contract. The sequencing also makes sense: docs cleanup first, then internal rename seams, then runtime enforcement. The main weakness is verification quality rather than task selection. Several plans prove that code compiles or that strings exist, but they do not always prove the user-facing behaviors the phase claims to lock down, especially around `aco setup`, `.wrapper/` artifact continuity, and env-var fallback behavior.

## Plan 01 — Cleanup legacy lockfile references and finalize phase metadata

**Summary**

This is a reasonable low-blast-radius opener for the phase. It usefully separates planning-doc cleanup from runtime changes, which keeps the later refactors cleaner. The main issue is that its verification step is both logically wrong and broader than the task scope, which could cause false failures or accidental scope expansion into archived planning artifacts.

**Strengths**
- Keeps documentation cleanup isolated from code changes.
- Directly addresses D-05 and removes ambiguity before runtime refactors begin.
- Ties roadmap metadata to explicit Phase 05 plan inventory, which helps downstream traceability.
- Low implementation risk and easy rollback.

**Concerns**
- `MEDIUM`: The verification command is incorrect. `grep -ri "wrapper.lock" .planning/ && ! grep -ri "aco.lock" .planning/` fails when the first grep finds nothing, which is the desired success case.
- `MEDIUM`: The task scope is the three core planning docs, but verification scans all of `.planning/`. That can fail on archived or historical docs and create pressure to edit out-of-scope records.
- `LOW`: “Mark Phase 05 as In Progress” is time-sensitive metadata and may be stale quickly if the plan executes near completion.
- `LOW`: The required summary artifact is named in `<output>` but not included in acceptance criteria or verification.

**Suggestions**
- Replace the verify step with explicit negative checks against only the intended files.
- State explicitly whether archived milestone docs are out of scope.
- Add acceptance criteria for creating `05-01-SUMMARY.md`.
- Treat roadmap status as phase-time metadata, not a long-lived invariant.

**Risk Assessment**

`MEDIUM` — The edits themselves are safe, but the current verification logic is brittle enough to block or misdirect execution.

---

## Plan 02 — Rename internal Config symbols and module to Aco branding

**Summary**

This is a good first refactor after doc cleanup. It scopes the rename around the config seam, preserves the on-disk `.wrapper.json` contract, and enumerates the main consumers. The risk is mostly around verification depth: build plus one config test is not quite enough to prove that all runtime entrypoints still load config correctly after the file/module rename.

**Strengths**
- Clean separation between internal branding rename and external disk contract.
- Explicitly preserves `.wrapper.json`, which is the key compatibility constraint.
- Enumerates the main consumer files, which reduces missed import risk.
- Includes both compile-time and test-time checks.

**Concerns**
- `MEDIUM`: The plan deletes `src/config/wrapper-config.ts` outright without saying whether any compatibility shim is intentionally unsupported. If anyone imports internal dist paths, this is a silent break.
- `MEDIUM`: Verification focuses on `build` and `test/config.test.ts`, but Phase 05 behavior depends on live CLI consumers like help, alias dispatch, and workflow resolution, not just the config reader in isolation.
- `LOW`: The test command should be written unambiguously as `npm test -- test/config.test.ts` or `node --test test/config.test.ts`.
- `LOW`: “Internal symbols use Aco prefix exclusively” is stronger than the actual checks. It would be easy to leave stale `WrapperConfig` references in live source/tests without detecting them.

**Suggestions**
- Add a repo-wide negative search over live `src/` and `test/` paths for `wrapper-config`, `WrapperConfig`, and `readWrapperConfig`.
- Add one CLI smoke test proving `help` and one workflow path still read `.wrapper.json` successfully after the rename.
- If deep imports are considered unsupported, state that explicitly in the plan; otherwise add a deprecated re-export shim for one phase.

**Risk Assessment**

`MEDIUM` — The refactor seam is well chosen, but runtime verification is lighter than the phase dependency surface.

---

## Plan 03 — Rename internal Artifact/Orchestration symbols to Aco branding

**Summary**

This is the cleanest plan in the set. It preserves the actual runtime contract, limits the rename to internal artifact helpers, and checks the right path invariant: artifacts must still land under `.wrapper/workflows/`. The only gap is that it proves artifact helpers and runner wiring, but not the full `aco workflow` user path end-to-end.

**Strengths**
- Correctly keeps `.wrapper/workflows` unchanged while renaming only internal symbols.
- Uses targeted tests that assert path continuity, not just symbol presence.
- Depends on Plan 02, which is the right ordering for config-first then orchestration rename.
- Low performance and security risk; mostly naming and wiring work.

**Concerns**
- `MEDIUM`: The title says “Artifact/Orchestration symbols,” but the plan only covers a narrow slice of orchestration code. That is fine in practice, but the title overstates completeness.
- `MEDIUM`: Verification does not include a CLI-level named workflow smoke test, even though Phase 05 success criterion 2 is about `aco` entrypoints preserving `.wrapper/` outputs.
- `LOW`: If “full internal rename” is intended literally, stale references in comments, docs, or non-built test helpers may remain undetected.

**Suggestions**
- Add one end-to-end `aco workflow ...` smoke test that asserts run artifacts appear under `.wrapper/workflows/...`.
- Narrow the plan title or explicitly define the rename boundary as artifact helpers plus immediate runner consumers.
- Add a negative search for old artifact symbol names in live `src/` and `test/` paths.

**Risk Assessment**

`LOW` — The plan is well-bounded and matches the runtime contract closely; it mainly needs stronger user-path verification.

---

## Plan 04 — Implement alias conflict protection and branding alignment

**Summary**

This is the most important plan because it carries the actual phase acceptance logic for built-in precedence and the final public-facing cleanup. It targets the right files, but it mixes in one extra concern (`ACO_CAO_BASE_URL` fallback) that is not clearly required by the phase, and its verification does not fully prove all claimed outcomes. The alias-conflict work is strong; the env-var and setup-contract proof is comparatively weak.

**Strengths**
- Puts alias conflict protection at the CLI entrypoint, which is the correct enforcement location.
- Requires the check before dispatch, which avoids shadowing bugs and inconsistent behavior.
- Keeps the runtime contract explicit: `.wrapper.json` stays on disk, `aco` is only branding.
- Hardcoded built-in validation is simple, cheap, and has negligible performance cost.

**Concerns**
- `MEDIUM`: `ACO_CAO_BASE_URL` fallback looks like scope creep. It is not part of the core Phase 05 requirements (`CMD-03`, `WRAP-01`, `WRAP-02`) as written.
- `MEDIUM`: The plan claims env-var fallback support, but the described test addition only covers alias conflicts. There is no behavioral verification of fallback or precedence.
- `MEDIUM`: The plan does not explicitly test the core success criterion that `aco setup` initializes or preserves `.wrapper.json` without rename work. Branding checks alone are not enough.
- `MEDIUM`: Built-in conflict coverage is too narrow if only one alias like `setup` is tested. The phase goal is about built-in precedence broadly.
- `LOW`: Some setup-branding work appears redundant with earlier command-surface work, which blurs phase boundaries.

**Suggestions**
- Either remove the env-var fallback from this plan or add explicit tests for:
  - `ACO_CAO_BASE_URL` preferred when both vars are set
  - `WRAPPER_CAO_BASE_URL` still works as fallback
- Add setup tests proving `.wrapper.json` is created on first run and preserved unchanged on rerun.
- Make the alias-conflict test table-driven across all reserved commands, not just `setup`.
- Consider deriving reserved command names from one centralized CLI metadata source to reduce future drift.

**Risk Assessment**

`MEDIUM` — The critical runtime-protection work is correctly placed, but the plan under-tests several claimed outcomes and includes one partially unproven extra behavior.

---

## Bottom Line

These plans are mostly good enough to achieve the phase, and the decomposition is sensible. The biggest improvements I’d make before execution are:

- Fix Plan 01 verification so it matches the actual docs scope.
- Strengthen Plan 02 and Plan 03 with one CLI-level smoke each.
- Tighten Plan 04 around phase goals, or fully test the added env-var fallback behavior.

If you want, I can turn this into a compact “approve / approve with changes / block” verdict matrix next.

---

## Claude Review

Claude (as the current runtime) or other reviewers skipped due to API limits or availability.

---

## Consensus Summary

Codex served as the primary reviewer. Key consensus points from its assessment:

### Agreed Strengths
- Plans are logically sequenced (docs first, then internal refactors, then enforcement).
- Direct alignment with D-01 through D-06 and v1.1 milestone goals.
- Good isolation of documentation cleanup from code changes.

### Agreed Concerns
- **MEDIUM**: Verification logic in Plan 05-01 is inverted ( will fail if string NOT found).
- **MEDIUM**: Verification coverage for ✓ prerequisites: cao, tmux, workmux found
✓ ~/.config/tmux/ai-cli.conf: already exists
✓ ~/.tmux.conf: already configured
✓ .wrapper.json: already exists
aco setup complete. and artifact continuity should be more behavioral, not just file existence.
- **LOW**: Env-var fallback testing should explicitly verify both preference for  and fallback to .

### Divergent Views
- None (Single reviewer).

---

## Claude Review

Claude (as the current runtime) or other reviewers skipped due to API limits or availability.

---

## Consensus Summary

Codex served as the primary reviewer. Key consensus points from its assessment:

### Agreed Strengths
- Plans are logically sequenced (docs first, then internal refactors, then enforcement).
- Direct alignment with D-01 through D-06 and v1.1 milestone goals.
- Good isolation of documentation cleanup from code changes.

### Agreed Concerns
- **MEDIUM**: Verification logic in Plan 05-01 is inverted (grep will fail if string NOT found).
- **MEDIUM**: Verification coverage for aco setup and artifact continuity should be more behavioral, not just file existence.
- **LOW**: Env-var fallback testing should explicitly verify both preference for ACO_ prefixed vars and fallback to WRAPPER_ prefixed vars.

### Divergent Views
- None (Single reviewer).
