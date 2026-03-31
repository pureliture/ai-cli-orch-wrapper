---
status: diagnosed
phase: 04-canonical-command-surface
source:
  - 04-01-SUMMARY.md
  - 04-02-SUMMARY.md
started: 2026-03-31T07:53:01Z
updated: 2026-03-31T08:13:14Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Canonical `aco` Command Works
expected: Running the CLI through `aco` should succeed as the public entrypoint. `aco help` should run without falling back to `wrapper` wording or a missing-command failure.
result: pass

### 2. Help and Version Use `aco`
expected: Help, usage, and version output identify the tool as `aco`, not `wrapper`, for normal public invocation paths.
result: pass

### 3. Unknown Command Recovery Uses `aco`
expected: If you run an unsupported subcommand, the CLI responds with `aco`-based recovery guidance instead of mixed or stale command names.
result: pass

### 4. Stale `wrapper` Entry Remediates to `aco`
expected: If you hit the old `wrapper` entrypath, the CLI fails fast and tells you directly to use `aco`, with one clear next step.
result: issue
reported: "테스트 결과자체는 pass 인데 wrapper라는 명령어 자체가 command not found로 잡혀야하는데 명령어로 인식이되고있네"
severity: major

### 5. Bare Invocation Recovers Cleanly
expected: Invoking the CLI without a subcommand exits cleanly and points you to the canonical `aco help` path rather than leaving you in an ambiguous state.
result: pass

### 6. `aco setup` Branding Stays Canonical
expected: Setup-managed user-facing wording says `aco setup`, while deferred runtime-contract names like `.wrapper.json` are still referenced where they are real on-disk paths.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "If you hit the old `wrapper` entrypath, the CLI fails fast and tells you directly to use `aco`, with one clear next step."
  status: failed
  reason: "User reported: 테스트 결과자체는 pass 인데 wrapper라는 명령어 자체가 command not found로 잡혀야하는데 명령어로 인식이되고있네"
  severity: major
  test: 4
  root_cause: "This machine still has a stale global `/opt/homebrew/bin/wrapper` symlink from an older npm link/install state. The current package metadata exposes only `aco`, but the leftover `wrapper` shim still resolves and then intentionally hits the CLI's fail-fast remediation path."
  artifacts:
    - path: "package.json"
      issue: "Current bin contract exposes only `aco`, so the observed `wrapper` command is not coming from the repo's published bin metadata."
    - path: "src/cli.ts"
      issue: "Legacy basename `wrapper` is intentionally detected and remediated to `Use aco ...`, which matches the runtime behavior once the stale shim is invoked."
    - path: "test/canonical-command-surface.test.ts"
      issue: "Regression coverage explicitly locks stale `wrapper` remediation, not shell-level `command not found` absence."
  missing:
    - "Clean up the stale global `wrapper` shim left in `/opt/homebrew/bin`."
    - "Add an install-state cleanup/relink path so old `wrapper` shims are removed when only `aco` should remain."
  debug_session: ".planning/debug/wrapper-still-resolves.md"
