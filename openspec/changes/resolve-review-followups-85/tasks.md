## 1. Repository Hygiene

- [x] 1.1 Add `reference/` to `.gitignore` without deleting the local reference checkout.
- [x] 1.2 Confirm the issue #85 worktree stays clean except for intended files.

## 2. Already Fixed, Reply/Resolve Only

- [x] 2.1 Confirm PR #83 `sync-config.ts` empty/comment-only/null YAML handling is already fixed on current main with existing tests.
- [x] 2.2 Reply to the PR #83 `sync-config.ts` review thread with current-main evidence and resolve it without code churn.
- [x] 2.3 Confirm PR #83 `duplicate-detector.ts` cleanup target directory handling and structured `cleanupTargets` are already fixed on current main.
- [x] 2.4 Reply to the PR #83 `duplicate-detector.ts` cleanup target review thread with current-main evidence and resolve it without code churn.

## 3. Code/Doc/Test Required

- [x] 3.1 Update `scripts/setup-github-project.sh` so missing Project, Status, or Priority IDs fail before success/export output.
- [x] 3.2 Update `scripts/setup-project-ids.sh` so incomplete canonical IDs exit non-zero before printing the shell export block.
- [x] 3.3 Add targeted shell or fixture coverage for missing Priority option IDs and incomplete export output.
- [x] 3.4 Update `docs/contract/go-node-boundary.md` to explain why Node Gemini auth can use `GOOGLE_API_KEY` while the Go runtime allowlist passes `GEMINI_API_KEY`.
- [x] 3.5 Replace the Node.js `바이너리명` wording with implementation-accurate language for provider-local `which()`/spawn behavior.
- [x] 3.6 Check related docs for conflicting `GOOGLE_API_KEY` or binary lookup wording and update only if needed.
- [x] 3.7 Update `readVersion()` or its callers so stderr-only successful `--version` output is accepted.
- [x] 3.8 Ensure successful empty-output probes do not make `GeminiProvider.checkAuth()` or `CodexProvider.checkAuth()` report `missing`.
- [x] 3.9 Add targeted provider or utility tests for stderr-only and empty-output successful probes.
- [x] 3.10 Update `--clean-duplicates` handling so cleaned target paths are removed from the same run's `plan.outputs` before the write loop.
- [x] 3.11 Add a regression test showing a cleaned duplicate target is not recreated during the same `aco sync --clean-duplicates --force-clean` run.
- [x] 3.12 Update skill directory hashing to include relative paths and raw bytes.
- [x] 3.13 Add regression tests for same-content file rename and non-UTF-8 byte differences.

## 4. Review Thread Mapping And Closure

- [x] 4.1 Fetch the 11 unresolved review threads for PR #70, #76, #77, #83, and #84 and map each to fixed, already-fixed, or blocked.
- [x] 4.2 Map PR #70 Project setup/export script threads to tasks 3.1 through 3.3.
- [x] 4.3 Map PR #76 Go/Node boundary doc threads to tasks 3.4 through 3.6.
- [x] 4.4 Map PR #77 provider readiness probe thread to tasks 3.7 through 3.9.
- [x] 4.5 Map PR #84 `sync-engine.ts` output recreation thread to tasks 3.10 and 3.11.
- [x] 4.6 Map PR #83 `skill-transform.ts` relative-path hash thread to tasks 3.12 and 3.13.
- [x] 4.7 Map PR #84 `skill-transform.ts` byte-hash thread to tasks 3.12 and 3.13.
- [x] 4.8 Reply to each fixed thread with the implementation and validation summary.
- [x] 4.9 Reply to each already-fixed thread with current-main evidence and avoid redundant code churn.
- [x] 4.10 Resolve all completed review threads through the GitHub review thread API.

## 5. Validation

- [x] 5.1 Run targeted tests for changed script, provider, and sync behavior.
- [x] 5.2 Run `openspec validate resolve-review-followups-85 --type change --strict`.
- [x] 5.3 Run `git diff --check`.
- [x] 5.4 Run broader wrapper checks such as `npm run typecheck --workspace=packages/wrapper` or `npm test --workspace=packages/wrapper` if touched code warrants it.
- [x] 5.5 Update issue #85 or PR body with final validation results when creating the PR.
