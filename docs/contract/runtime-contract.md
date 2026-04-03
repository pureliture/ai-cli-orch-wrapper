# aco Wrapper Runtime Contract

**Version:** 1.1 (Phase 0 — post staged-review fixes)
**Status:** Normative. The Go wrapper must satisfy all requirements marked MUST.
**Scope:** Wrapper runtime only (`aco` binary). Installer (`aco-install`) is out of scope.

This document defines the behavioral contract that the Go wrapper implementation
must satisfy before the Node.js wrapper (`@aco/wrapper`) is removed.

Where current Node.js behavior differs from this contract, the contract takes
precedence. Do not copy Node.js bugs into the Go implementation.

---

## 1. `aco run`

### Invocation
```
aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted]
```

### Behavior

**R-RUN-01 (MUST):** Before spawning the provider process, verify that the provider
binary is present in PATH. If not found, print a human-readable error message that
includes the install hint for the provider, and exit with code 1. Do NOT attempt to
spawn a non-existent binary and surface a raw OS error.

**R-RUN-02 (MUST):** Create the session record (`task.json`) with status `running`
before spawning the provider process. The session directory and `task.json` MUST
exist on disk before `spawn()` is called.

**R-RUN-03 (MUST):** The process PID MUST be written to `task.json` before the first
byte of provider stdout is forwarded to the caller. This is a synchronous ordering
requirement: persist PID, then begin streaming. A fire-and-forget async PID write
(where the PID reaches disk after streaming starts) does NOT satisfy this requirement.

**R-RUN-04 (MUST):** Provider stdout MUST be tee'd: forwarded to the caller's stdout
AND written to `output.log` simultaneously. Neither path may buffer the entire output
— chunks MUST be forwarded and written as they arrive from the provider process.

**R-RUN-05 (MUST):** Provider stderr MUST be captured and written to `error.log`.
Stderr MUST NOT be forwarded to the caller's stdout. Stderr capture MUST not block
stdout forwarding.

**R-RUN-06 (MUST):** On clean provider exit (exit code 0): call `markDone`. Set
`status: done` and `endedAt` in `task.json`. Exit `aco run` with code 0.

**R-RUN-07 (MUST):** On non-zero provider exit: call `markFailed`. Set
`status: failed`, `exitCode: <n>`, and `endedAt` in `task.json`. Write the error
reason to `error.log`. Exit `aco run` with code 1.

**R-RUN-08 (MUST):** On provider process killed by signal: call `markFailed`. Set
`status: failed`, `signal: "<name>"`, and `endedAt` in `task.json`. Exit `aco run`
with code 1.

**R-RUN-09 (MUST):** `aco run` MUST enforce a spawn timeout. If the provider process
does not exit within the configured timeout window, the wrapper MUST initiate
cancellation (see R-CANCEL-03 for signal escalation semantics) and call `markFailed`
with `signal: "timeout"`. Default timeout: 300 seconds. The timeout MUST be
configurable via the `--timeout` flag or `ACO_TIMEOUT_SECONDS` environment variable.

**R-RUN-10 (MUST):** Stdin to the provider process MUST be closed immediately after
spawn (not piped through from the wrapper's own stdin, unless `--input` content is
being forwarded). Provider processes that wait for stdin must not hang `aco run`.

**R-RUN-11 (MUST):** If `--input` content is provided (via flag or piped stdin), it
MUST be passed as part of the provider invocation. The exact mechanism is
provider-specific (flag vs stdin vs prompt concatenation).

**R-RUN-12 (SHOULD):** The prompt for the command is resolved in this order:
1. `./.claude/aco/prompts/<provider>/<command>.md` (cwd-local override)
2. `~/.claude/aco/prompts/<provider>/<command>.md` (global)
3. Embedded default prompt (compiled into binary via `embed.FS`)

If neither file exists, the embedded default is used WITHOUT printing a warning.
Prompt text MUST NOT be sourced from the installer's deployed files at runtime —
the binary is the source of truth for default prompts.

---

## 2. `aco status`

### Invocation
```
aco status [--session <uuid>]
```

### Behavior

**R-STATUS-01 (MUST):** With no `--session` flag: operate on the latest session
(see R-LATEST-01). If no sessions exist, print an error and exit with code 1.

**R-STATUS-02 (MUST):** Output format (one field per line, key-colon-value):
```
Session:    <uuid>
Provider:   <provider>
Command:    <command>
Status:     <running|done|failed|cancelled>
Started:    <ISO 8601>
Ended:      <ISO 8601>          # omit if not yet ended
PID:        <n>                 # omit if not running or PID not recorded
ExitCode:   <n>                 # present if status=failed and exit was numeric
Signal:     <name>              # present if status=failed and exit was by signal
Permission: <profile>           # omit if not set
```

**R-STATUS-03 (MUST):** `aco status` MUST report session lifecycle state only. It
MUST NOT perform provider health checks, auth verification, or binary presence checks.
Provider health is the responsibility of `aco-install provider setup <name>`.

**R-STATUS-04 (MUST):** Exit codes:
- `0` if status is `done`
- `1` if status is `failed` or session not found
- `2` if status is `cancelled`
- `3` if status is `running`

**R-STATUS-05 (MUST, temporary):** When reading a `task.json` that has `status: failed`
but neither `exitCode` nor `signal` is present (created by the Node.js wrapper before
cutover), display `ExitCode: unknown` and `Signal: unknown` rather than erroring.
This requirement may be removed after the Node.js wrapper is deleted and all
pre-migration sessions have expired.

---

## 3. `aco result`

### Invocation
```
aco result [--session <uuid>]
```

### Behavior

**R-RESULT-01 (MUST):** With no `--session` flag: operate on the latest session
(see R-LATEST-01).

**R-RESULT-02 (MUST):** If the session status is `running`: print the current
contents of `output.log` (which may be partial), preceded by a banner line:
```
⟳ Session <uuid> is still running — partial output below
```
Exit with code 3.

**R-RESULT-03 (MUST):** If the session status is `done`: print the full contents of
`output.log`. Exit with code 0.

**R-RESULT-04 (MUST):** If the session status is `failed`: print the contents of
`output.log` (which may be partial), followed by the contents of `error.log` if
non-empty, preceded by a separator:
```
--- error ---
<error.log contents>
```
Exit with code 1.

**R-RESULT-05 (MUST):** If the session status is `cancelled`: print the contents of
`output.log` (which may be partial or empty), preceded by a banner:
```
✗ Session <uuid> was cancelled — partial output below
```
Exit with code 2.

**R-RESULT-06 (MUST):** If `output.log` does not exist (session created but provider
never started): print an appropriate message. Do NOT crash or print a raw filesystem
error.

---

## 4. `aco cancel`

### Invocation
```
aco cancel [--session <uuid>]
```

### Behavior

**R-CANCEL-01 (MUST):** With no `--session` flag: operate on the latest session
(see R-LATEST-01).

**R-CANCEL-02 (MUST):** If the session status is already `done`, `failed`, or
`cancelled`: print a warning and exit with code 0. Do NOT error.

**R-CANCEL-03 (MUST):** Signal escalation: send SIGTERM to the provider process.
Poll for process exit for up to 3 seconds. If the process has not exited after 3
seconds, send SIGKILL. Do NOT return from `aco cancel` until one of the following
is true: (a) the process has exited, (b) SIGKILL has been sent.

**R-CANCEL-04 (MUST):** After signaling, call `markCancelled`. Set
`status: cancelled` and `endedAt` in `task.json`.

**R-CANCEL-05 (MUST):** If the PID field is absent from `task.json` (race: cancel
arrived before PID was written): wait up to 1 second for the PID to appear, polling
`task.json`. If PID is still absent after 1 second, mark the session cancelled
without signaling. Log a warning to stderr.

**R-CANCEL-06 (MUST):** If `process.kill(pid)` returns an error indicating the
process no longer exists: treat as already exited. Call `markCancelled` and exit 0.

**R-CANCEL-07 (SHOULD):** Print a confirmation message on successful cancel:
```
Session <uuid> cancelled.
```

---

## 5. Process Spawn

**R-SPAWN-01 (MUST):** Provider binary must be located via PATH lookup, not hardcoded
paths. The same binary that would be found by `which <provider>` in the user's shell
is the binary that must be spawned.

**R-SPAWN-02 (MUST):** The provider process inherits the current environment
(`env: os.Environ()` in Go). Provider CLI tools rely on environment variables for
auth (e.g., `GEMINI_API_KEY`, `GH_TOKEN`).

**R-SPAWN-03 (MUST):** The provider process MUST be spawned in the current working
directory of the `aco run` invocation, not the wrapper binary's directory. Provider
tools may read local config files (`.gemini/`, `.github/`) relative to cwd.

**R-SPAWN-04 (MUST):** Stdin for the provider process MUST be closed immediately
after spawn unless `--input` content is being written. An open stdin causes some CLI
tools to wait indefinitely.

**R-SPAWN-05 (SHOULD):** The provider process MUST NOT be started in a new process
group (no `setsid` / `Setpgid: true`) unless explicitly required for a provider.
Keeping the same process group ensures the OS delivers SIGHUP correctly when the
terminal session ends.

---

## 6. Output Tee / Live Output

**R-TEE-01 (MUST):** stdout chunks from the provider process MUST be forwarded to
the wrapper's stdout AND written to `output.log` with no intermediate buffering.
Each chunk is forwarded as it arrives from the OS pipe.

**R-TEE-02 (MUST):** `output.log` MUST be created with permissions `0600`. The
session directory MUST be created with permissions `0700`.

**R-TEE-03 (MUST):** `output.log` MUST be flushed and closed before `markDone` or
`markFailed` is called. The log MUST be complete when the session status transitions
to a terminal state.

**R-TEE-04 (MUST):** If the provider process is cancelled (SIGTERM/SIGKILL), any
bytes already written to `output.log` MUST be preserved. Cancellation MUST NOT
truncate or delete partial output.

---

## 7. Stderr Capture

**R-STDERR-01 (MUST):** Provider stderr MUST be captured into `error.log`.

**R-STDERR-02 (MUST):** `error.log` MUST be created with permissions `0600`.

**R-STDERR-03 (MUST):** Stderr capture MUST NOT impose a size cap that silently
discards content. If a cap is implemented for memory safety, the truncation point
MUST be recorded in `error.log` (e.g., `[stderr truncated at N bytes]`).

**R-STDERR-04 (MUST):** Stderr MUST NOT be forwarded to `aco run`'s stdout.
Provider error output is only accessible via `aco result` (which prints `error.log`).

---

## 8. Session Persistence

**R-PERSIST-01 (MUST):** All `task.json` writes MUST be atomic: write to a temporary
file in the same directory, then rename over `task.json`. A non-atomic write that
leaves a partially-written `task.json` on process kill is a correctness failure.

**R-PERSIST-02 (MUST):** Session directory: `~/.aco/sessions/<uuid>/`
Permissions: `0700`

**R-PERSIST-03 (MUST):** Files in the session directory:

| File | Permissions | Written by |
|------|-------------|-----------|
| `task.json` | `0600` | All transitions |
| `output.log` | `0600` | `aco run` (tee) |
| `error.log` | `0600` | `aco run` (stderr capture) |

**R-PERSIST-04 (MUST):** `task.json` MUST be valid JSON at all times. A reader that
opens `task.json` while a write is in progress MUST either read the old version or
the new version, never a partial file.

**R-PERSIST-05 (SHOULD):** The session store MUST maintain a `~/.aco/sessions/latest`
pointer file containing the UUID of the most recently created session. `latestId()`
MUST read this file rather than scanning all session directories.

**R-PERSIST-06 (MUST):** If the `ACO_SESSION_DIR` environment variable is set, the
session base directory MUST be that path instead of `~/.aco/sessions/`. This override
exists solely for test isolation — fixture tests inject this variable to redirect
session writes to a temporary directory. The Go wrapper binary MUST check this variable
at startup. Production deployments MUST NOT set this variable.

---

## 9. exitCode / Signal Recording

**R-EXIT-01 (MUST):** `task.json` for a terminal session MUST include:
- `exitCode: number` if the provider exited with a numeric exit code (including 0)
- `signal: string` if the provider was killed by a signal (e.g., `"SIGTERM"`, `"SIGKILL"`, `"timeout"`)
- Both `exitCode` and `signal` MUST NOT be simultaneously present for the same exit event

**R-EXIT-02 (MUST):** `exitCode: 0` is recorded for a successful (done) session.

**R-EXIT-03 (MUST):** A timeout-induced kill is recorded as `signal: "timeout"`, not
as `signal: "SIGKILL"`. The distinction matters for diagnostics.

---

## 10. Latest-Session Resolution

**R-LATEST-01 (MUST):** When `--session` is not provided, all session-reading
commands (`status`, `result`, `cancel`) operate on the latest session as determined
by the `~/.aco/sessions/latest` pointer file.

**R-LATEST-02 (MUST):** The `latest` pointer is written atomically (temp+rename)
each time a new session is created via `aco run`.

**R-LATEST-03 (MUST):** If the `latest` pointer file does not exist or points to a
non-existent session directory, the command MUST print an error and exit with code 1.
It MUST NOT fall back to directory scanning.

---

## 11. Provider Availability Failure

**R-AVAIL-01 (MUST):** If the provider binary is not found in PATH before `aco run`
spawns it: exit code 1 with a message that includes:
- The provider name
- The install hint (e.g., `npm install -g @google/gemini-cli`)
- The message MUST be printed to stderr, not stdout

**R-AVAIL-02 (MUST):** `aco run` MUST check availability synchronously before
creating the session. If the provider is unavailable, no session directory or
`task.json` is created.

---

## 12. Auth Failure Classification

**R-AUTH-01 (MUST):** Auth failure is classified as a distinct error type from
provider binary absence. The error message MUST distinguish between:
- Binary not found (`ProviderNotFoundError`)
- Binary found but auth check failed (`ProviderAuthError`)
- Binary exited non-zero during actual invocation (`ProviderExitError`)
- Invocation timed out (`ProviderTimeoutError`)

**R-AUTH-02 (MUST):** Auth failure detected during `aco run` (not during
`aco-install provider setup`): `markFailed` with `signal: "auth-failure"`. The
auth hint MUST be written to `error.log`.

**R-AUTH-03 (SHOULD):** The Go wrapper MUST NOT perform auth checks as a pre-flight
before every `aco run`. Auth failure during actual invocation is classified at the
provider boundary. Proactive auth checking is the responsibility of `aco-install
provider setup <name>`.

**R-AUTH-04 (MUST):** Auth failure classification during `aco run` uses the following
heuristics, applied in order. A match on any criterion triggers `signal: "auth-failure"`:

1. Provider process exited with code 126 (POSIX: command found but not executable,
   used by some CLIs to signal auth/permission denial)
2. Provider stderr contains any of: `unauthenticated`, `unauthorized`,
   `authentication required`, `auth`, `login required`, `token`, `credential`
   (case-insensitive substring match)
3. Provider-specific overrides (registered in provider implementation):
   - `gemini`: exit 1 AND stderr contains `unauthenticated` or `please run`
   - `copilot`: requires `gh auth status` to succeed; if it fails, classify as auth failure
     before spawning the provider process

If none of these criteria match, a non-zero exit is classified as `ProviderExitError`
with the numeric exit code recorded in `task.json` as `exitCode`.

The detection heuristics are registered per-provider in the provider implementation,
not hardcoded in the runner. Each provider may override or extend the default criteria.

---

## Appendix: Known Node.js Implementation Gaps

The following behaviors in the current Node.js implementation do NOT satisfy this
contract. The Go wrapper MUST NOT replicate them.

| Gap | Location | Contract Requirement |
|-----|----------|---------------------|
| PID written fire-and-forget | `cli.ts:97-99` | R-RUN-03 |
| No spawn timeout | `spawn-stream.ts` | R-RUN-09 |
| No SIGKILL escalation in cancel | `cli.ts:201` | R-CANCEL-03 |
| `task.json` written non-atomically | `store.ts:43,50` | R-PERSIST-01 |
| `latestId()` scans all directories | `store.ts:86-94` | R-PERSIST-05, R-LATEST-01 |
| `markFailed` does not record exitCode/signal | `store.ts:64-66` | R-EXIT-01 |
| `aco result` does not check session status | `cli.ts:136-143` | R-RESULT-02..05 |
| `aco status` does not output exitCode/signal | `cli.ts:157-168` | R-STATUS-02 |
| Stderr capped at 4000 chars silently | `spawn-stream.ts:11` | R-STDERR-03 |
| No R-CANCEL-05 (PID race on cancel) | `cli.ts:199-205` | R-CANCEL-05 |
| Prompt falls back silently to hardcoded string | `cli.ts:79` | R-RUN-12 (embed.FS) |
