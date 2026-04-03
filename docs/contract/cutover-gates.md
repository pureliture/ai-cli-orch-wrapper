# Cutover Gates

**Purpose:** Defines what must be green before the Node.js wrapper (`@aco/wrapper`)
is removed from the repository and the Go binary becomes the sole `aco` runtime.

All gates are MUST unless marked SHOULD. A single failing MUST gate blocks cutover.

---

## Gate 1: Behavioral Contract Fixtures (all 12 must pass)

The fixture harness (`test/fixtures/`) must pass 100% against the Go binary.
No fixture may be skipped or marked expected-failure at cutover time.

| Fixture | Pass Criterion |
|---------|---------------|
| 01-streaming-output | At least 2 chunks arrive before process exits |
| 02-pid-capture-timing | PID present in task.json within 100ms of spawn |
| 03-cancel-sigterm-sigkill | Process exits within 3.5s of cancel request; SIGKILL sent if not exited within 3s |
| 04-cancel-partial-output | output.log non-empty after cancel if provider wrote anything |
| 05-exit-code-recording | task.json contains exitCode field for done/failed sessions |
| 06-timeout-marking | Timed-out session has signal="timeout" in task.json |
| 07-provider-not-found | Exit code 1; install hint in stderr; no session directory created |
| 08-auth-failure | Exit code 1; auth hint in error.log; signal="auth-failure" in task.json |
| 09-status-lifecycle | aco status output matches schema for all 4 lifecycle states |
| 10-result-running-session | Partial output + banner; exit code 3 |
| 11-result-failed-session | output.log + error.log separator; exit code 1 |
| 12-latest-session-resolution | aco status / result / cancel with no --session use latest pointer file |

---

## Gate 2: ccg-workflow Parity Checklist (all 17 items must be checked)

All items in `docs/contract/ccg-parity-checklist.md` must be manually verified
against the Go implementation by code review before cutover.

Checklist items CPW-01 through CPW-17 must each have a corresponding code
reference (file:line) noted in a review comment or companion document.

---

## Gate 3: Platform Matrix (all 4 must build and pass integration test)

| Platform | Go Build | Integration Test |
|----------|----------|-----------------|
| darwin/arm64 | ✓ | ✓ |
| darwin/amd64 | ✓ | ✓ |
| linux/amd64 | ✓ | ✓ |
| linux/arm64 | ✓ | (manual OK or CI) |

Integration test = run `aco run gemini review` against a real Gemini CLI instance
and verify: session created, output streamed, session marked done, output.log populated.

---

## Gate 4: Installer End-to-End

All three installer paths must work on a clean machine (no existing `~/.aco/`):

- [ ] `npx aco-install pack install` → places Go binary at correct path, installs templates
- [ ] `aco --version` → returns Go binary version string (not Node version)
- [ ] `aco-install pack status` → reports all components installed
- [ ] `aco-install pack uninstall` → removes all files listed in manifest; `aco` no longer in PATH

Test must be run on at least: macOS (darwin/arm64) and one Linux (linux/amd64).

---

## Gate 5: `npm test` Passes with No Node Wrapper

After removing `packages/wrapper/`:

- [ ] `npm install` succeeds (workspace dependency removed from root)
- [ ] `npm test` passes (no test references `@aco/wrapper` package)
- [ ] `npm run build` succeeds (no TypeScript errors from removed package)
- [ ] No `import` in `packages/installer/` references `@aco/wrapper`

---

## Gate 6: No Orphaned Provider Processes

Manual verification:

- [ ] Run `aco run gemini review` with large input; immediately run `aco cancel`
- [ ] Verify with `ps aux | grep gemini` that no gemini process remains after cancel

- [ ] Run `aco run gemini review` with `--timeout 5` on a slow query
- [ ] Verify session ends with `signal: "timeout"` and no gemini process remains

---

## Gate 7: `task.json` Is Never Partially Written

Stress test:

- [ ] Run `aco run gemini review` and send `kill -9 <aco-pid>` during execution
- [ ] Verify `task.json` is either the pre-kill version (still `running`) or a
  complete post-kill version — never a zero-byte or partial JSON file
- [ ] Verify `output.log` is non-empty if the provider had started writing

---

## Gate 8: CLAUDE.md Updated

- [ ] `CLAUDE.md` reflects Go binary as the wrapper runtime
- [ ] References to `packages/wrapper/` removed or updated
- [ ] Build instructions updated to include Go toolchain requirement

---

## Anti-gates: What Does NOT Block Cutover

The following items are desirable but do not block the initial Go cutover:

- Session pruning / TTL cleanup
- `aco list` (session listing command)
- Per-provider timeout configuration via config file
- Windows support
- Go binary code signing (notarization on macOS)
- OpenTelemetry / structured logging
- `aco --version` showing build timestamp/commit
