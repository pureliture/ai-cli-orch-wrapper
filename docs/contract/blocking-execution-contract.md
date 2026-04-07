# Blocking Execution Contract

**Status:** Normative
**Phase:** A (replaces runtime-contract.md, session-schema.md, ccg-parity-checklist.md)
**Reference:** `reference/ccg-workflow/codeagent-wrapper/executor.go`

---

## 1. Execution Model

`aco run` is **synchronous and blocking**.

```
Claude Code slash command
  │ bash dispatch
  ▼
aco run <provider> <command>    ← blocks until provider exits
  │ streams stdout directly to caller
  │ owns exec.Cmd in memory for duration of run
  ▼
exits when provider completes or is cancelled
```

There is no daemon. There is no session registry. There is no IPC.
`aco cancel`, `aco status`, `aco result` do not exist.

---

## 2. Signal Handling

When `aco run` receives SIGTERM or SIGINT (from the OS or Claude Code):

1. Forward `SIGTERM` to the provider process via `proc.Signal(syscall.SIGTERM)`
2. Start `time.AfterFunc(forceKillDelay, proc.Kill)` — sends SIGKILL if process still alive
3. Wait for provider to exit

**Reference:** `executor.go:1322-1358` (`forwardSignals`)

```go
// ccg-workflow pattern — copy exactly:
_ = proc.Signal(syscall.SIGTERM)
time.AfterFunc(time.Duration(forceKillDelay)*time.Second, func() {
    if p := cmd.Process(); p != nil {
        _ = p.Kill()
    }
})
```

**Force-kill delay:** 5 seconds (ccg-workflow default, `main.go:67`).

**Note on `cmd.WaitDelay`:** ccg-workflow does NOT use `cmd.WaitDelay`.
Phase B must verify whether `cmd.WaitDelay` is needed or should be removed.
Do not assume it is equivalent to the `AfterFunc` pattern.

---

## 3. Timeout

Context timeout wraps the entire run:

```go
ctx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
defer cancel()
```

On deadline: the `terminateCommand` pattern sends SIGTERM → AfterFunc SIGKILL.

**Reference:** `executor.go:966-967`, `executor.go:1431-1467`

Default timeout: 300 seconds (configurable via `--timeout` or `ACO_TIMEOUT_SECONDS`).

---

## 4. Process Ownership

- `exec.Cmd` is created and owned within the `Run` function scope
- The process handle (`*os.Process`) is held in memory for the duration of the run
- Cancellation uses the live `proc` reference directly — never a stored PID
- PID is NOT written to disk; there is no `task.json`

**Reference:** `executor.go:975` — cmd is a local variable
**Reference:** `executor.go:1451` — `proc.Signal(syscall.SIGTERM)` on live handle

---

## 5. Output

- Provider stdout is streamed directly to `aco run`'s stdout
- No `output.log` file
- No `~/.aco/sessions/` directory
- No tee — output goes to one destination: the caller's stdout

**Reference:** `executor.go:1032-1038` — stdout pipe, single consumer

---

## 6. Exit Classification

| Provider exit | `aco run` exit code | Error type |
|--------------|---------------------|------------|
| Exit 0 | 0 | — |
| Exit non-zero (non-auth) | 1 | `*provider.ExitError` |
| Auth failure (provider-specific heuristic) | 1 | `*provider.AuthError` |
| Context timeout | 1 | `*provider.TimeoutError` |
| Signal termination | 1 | `*provider.SignalError` |
| Binary not found | 1 | `*provider.NotFoundError` |

---

## 7. What Does Not Exist

The following are explicitly absent:

| Removed | Why |
|---------|-----|
| `aco cancel` | Cancel comes from OS SIGTERM to `aco run` directly |
| `aco status` | No async state — execution is blocking |
| `aco result` | No log files — output streams inline |
| `~/.aco/sessions/` | No session persistence |
| `task.json` | No session schema |
| PID files | Cancellation uses live proc handle, not stored PID |
| Supervisor daemon | No long-lived process needed |
| Unix domain socket IPC | No cross-process coordination needed |

---

## 8. Phase B Implementation Target

Phase B must rewrite `internal/runner/process.go` and `cmd/aco/cmd_run.go` to copy:

| Function | Reference location |
|----------|--------------------|
| `forwardSignals` | `executor.go:1322-1358` |
| `terminateCommand` | `executor.go:1431-1467` |
| Main execution loop | `executor.go:966-1319` |

The implementation must be recognizable as a copy of the reference, not a local invention.

---

*ccg-workflow copy. No invention. Blocking model. OS handles cancel.*
