---
status: diagnosed
trigger: "Investigate issue: uat-04-wrapper-still-resolves"
created: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:14:00Z
---

## Current Focus

hypothesis: Confirmed. A stale global `/opt/homebrew/bin/wrapper` symlink from an older install/link still exists even though the current package bin contract exposes only `aco`.
test: Completed.
expecting: Confirmed by observed metadata and shell behavior.
next_action: Return diagnosis with root cause and fix direction.

## Symptoms

expected: Hitting `wrapper` should result in shell-level `command not found` rather than invoking the CLI and printing remediation.
actual: `wrapper` resolves to a global executable and runs the CLI, which then prints `Use aco help.` / `Use aco setup.` style remediation.
errors: None reported from the CLI itself.
reproduction: Run `command -v wrapper` and then `wrapper help` in /Users/pureliture/ai-cli-orch-wrapper.
started: Discovered during Phase 04 UAT test 4 on 2026-03-31.

## Eliminated

## Evidence

- timestamp: 2026-03-31T00:00:00Z
  checked: user-provided shell resolution
  found: "`command -v wrapper` resolves to `/opt/homebrew/bin/wrapper`."
  implication: The shell still has a registered executable named `wrapper`; this is not a pure CLI message-format issue.

- timestamp: 2026-03-31T00:00:00Z
  checked: user-provided symlink target
  found: "`/opt/homebrew/bin/wrapper` is a symlink to `../lib/node_modules/ai-cli-orch-wrapper/dist/cli.js`."
  implication: The stale command is coming from npm-managed global install/link state, not from a shell alias or function.

- timestamp: 2026-03-31T00:00:00Z
  checked: user-provided global npm package state
  found: "`npm ls -g ai-cli-orch-wrapper --depth=0` reports `ai-cli-orch-wrapper@0.2.0 -> ./../../../Users/pureliture/ai-cli-orch-wrapper`."
  implication: This machine has a live global link to the current repo, so historical install artifacts can persist independently of the current source tree.

- timestamp: 2026-03-31T00:00:00Z
  checked: Phase 04 code and test surface
  found: "`package.json` exposes only `aco`, `src/cli.ts` fail-fast rejects basename `wrapper`, and `test/canonical-command-surface.test.ts` covers stale `wrapper` remediation rather than shell-level absence."
  implication: The repository implements runtime remediation for stale `wrapper` invocations, but that does not itself remove an already-installed global `wrapper` executable.

- timestamp: 2026-03-31T00:10:00Z
  checked: debug knowledge base
  found: "`.planning/debug/knowledge-base.md` does not exist."
  implication: There is no prior recorded known-pattern diagnosis for this issue in the project debug archive.

- timestamp: 2026-03-31T00:10:00Z
  checked: global linked package metadata
  found: "`/opt/homebrew/lib/node_modules/ai-cli-orch-wrapper/package.json` exposes only `bin.aco = dist/cli.js`; there is no `wrapper` bin entry."
  implication: The current install metadata is not requesting a `wrapper` executable, so the live `wrapper` path is stale residue rather than an intended current bin.

- timestamp: 2026-03-31T00:10:00Z
  checked: global Homebrew bin directory
  found: "`/opt/homebrew/bin/aco` and `/opt/homebrew/bin/wrapper` both exist and both point to `../lib/node_modules/ai-cli-orch-wrapper/dist/cli.js`; `wrapper` is timestamped Mar 24 while `aco` is timestamped Mar 31."
  implication: The `aco` cutover created the new canonical executable, but the older `wrapper` symlink remained in place instead of being cleaned up.

- timestamp: 2026-03-31T00:14:00Z
  checked: runtime behavior through stale global executable
  found: "Running `wrapper help` exits 1 and prints `Use aco help.`."
  implication: The lingering shell command reaches the current CLI's fail-fast stale-invocation path, confirming the issue is leftover machine install state rather than stale source code still advertising `wrapper`.

## Resolution

root_cause: "The machine still has an old global npm/Homebrew-bin symlink at `/opt/homebrew/bin/wrapper` from a pre-cutover install/link. The current linked package metadata now exposes only `aco`, but nothing removed the already-created `wrapper` executable, so the shell continues resolving it and then lands in the intentional fail-fast remediation inside `src/cli.ts`."
fix: "Remove the stale global `wrapper` symlink or fully unlink/uninstall and relink the package so only `aco` remains registered in the global bin directory. The repository code already implements runtime remediation; the missing piece is install-state cleanup."
verification: "Confirmed current metadata has only `bin.aco`, both global bin entries point to the same linked `dist/cli.js`, and `wrapper help` still resolves and executes the current fail-fast path."
files_changed: []
