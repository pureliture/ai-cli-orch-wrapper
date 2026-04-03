# ccg-workflow Parity Checklist

**Scope:** Wrapper/runtime layer only.
This checklist covers behaviors the Go wrapper MUST implement with structural
parity to ccg-workflow's `codeagent-wrapper`. It does NOT include ccg-workflow's
broader framework concepts (workflow identities, frontend/backend routing,
methodology artifacts, generalized orchestration).

Each item maps to a runtime-contract requirement. All items are MUST unless marked SHOULD.

---

## Process Lifecycle

- [ ] **CPW-01** — PID is captured from the spawned process handle before any goroutine
  begins consuming stdout. The PID is written to `task.json` before `io.Copy`
  (or equivalent) is called. There is no async gap between "spawn returns" and "PID on disk."
  → R-RUN-03

- [ ] **CPW-02** — `exec.CommandContext` (or equivalent) is used so that context
  cancellation reaches the child process at the OS level unconditionally, without
  requiring every call site to check a signal.
  → R-RUN-09, R-CANCEL-03

- [ ] **CPW-03** — Stdout and stderr are consumed in separate goroutines. A provider
  that writes only to stderr (and nothing to stdout) does not deadlock the wrapper.
  → R-TEE-01, R-STDERR-01

- [ ] **CPW-04** — `output.log` is flushed before `cmd.Wait()` returns (or before the
  equivalent of `markDone` is called). Log completeness is guaranteed at the time the
  session status transitions to `done`.
  → R-TEE-03

- [ ] **CPW-05** — Stdin is closed immediately after spawn when no content is being
  written. Provider binaries that wait for EOF on stdin do not block `aco run`.
  → R-SPAWN-04, R-RUN-10

---

## Cancellation and Signal Escalation

- [ ] **CPW-06** — Cancellation sends SIGTERM first, then polls for process exit for a
  bounded window (≤ 3 seconds), then sends SIGKILL unconditionally if the process has
  not exited. This is a two-phase kill, not a single SIGTERM.
  → R-CANCEL-03

- [ ] **CPW-07** — Cancellation after timeout uses the same two-phase kill. The timeout
  path and the explicit-cancel path share the same signal escalation logic.
  → R-RUN-09, R-CANCEL-03

- [ ] **CPW-08** — Partial `output.log` content is preserved on cancellation. The tee
  is not closed or flushed by the cancel path — it is flushed naturally when the
  process exits (after SIGTERM or SIGKILL).
  → R-TEE-04, R-CANCEL-04

- [ ] **CPW-09** — A cancel request that arrives before the PID is present in `task.json`
  is handled without panicking or silently doing nothing. The implementation polls for
  the PID to appear within a bounded window before giving up.
  → R-CANCEL-05

---

## Session State Atomicity

- [ ] **CPW-10** — Every `task.json` write uses a temp-file-then-rename pattern.
  A reader of `task.json` always sees either the old complete version or the new
  complete version, never a partial file.
  → R-PERSIST-01, R-PERSIST-04

- [ ] **CPW-11** — Session directory is created with permissions `0700`.
  `task.json`, `output.log`, and `error.log` are created with permissions `0600`.
  → R-PERSIST-02, R-PERSIST-03, R-TEE-02, R-STDERR-02

- [ ] **CPW-12** — The latest-session pointer (`~/.aco/sessions/latest`) is written
  atomically (temp+rename) each time a new session is created. `latestId()` reads
  only this file; it does not scan session directories.
  → R-PERSIST-05, R-LATEST-01, R-LATEST-02

---

## Error Classification

- [ ] **CPW-13** — Errors at the provider boundary are typed, not plain strings.
  Callers can distinguish (without string parsing) between:
  - Provider binary not found
  - Provider auth failure
  - Provider process exited non-zero (with exit code)
  - Provider process killed by signal (with signal name)
  - Timeout
  → R-AUTH-01, R-EXIT-01

- [ ] **CPW-14** — `task.json` for a failed session includes either `exitCode` (numeric)
  or `signal` (string), not both, not neither.
  → R-EXIT-01

- [ ] **CPW-15** — A timeout-induced kill records `signal: "timeout"` in `task.json`,
  distinguishable from `signal: "SIGKILL"` (which would mean an external kill, not a
  wrapper-initiated timeout).
  → R-EXIT-03

---

## Provider Availability

- [ ] **CPW-16** — Provider binary presence is checked synchronously before session
  creation. If the binary is absent, no session directory is created and the error
  message includes the install hint.
  → R-AVAIL-01, R-AVAIL-02

- [ ] **CPW-17** — Environment is inherited from the calling process (`os.Environ()`).
  Provider CLIs that depend on env vars for auth (`GEMINI_API_KEY`, `GH_TOKEN`, etc.)
  receive the same environment as a direct shell invocation.
  → R-SPAWN-02

---

## Items Explicitly OUT of scope for this checklist

The following ccg-workflow concepts are NOT part of this parity requirement:

- SSE / live output over HTTP (ccg-workflow server mode)
- Browser auto-open on session start
- Windows console suppression / Windows process group handling
- Cross-platform binary packaging via Makefile targets
- Workflow phase identities (discover, define, develop, deliver)
- Agent role routing
- Any session behavior beyond: run, status, result, cancel
