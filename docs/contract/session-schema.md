# Session Schema Contract

**Version:** 1.0 (Phase 0)
**Status:** Normative. The Go wrapper MUST implement this schema exactly.

This document defines the canonical schema for `task.json` and the session
directory layout. The schema is designed for the Go implementation and is not
limited by the current Node.js implementation.

---

## Directory Layout

```
~/.aco/sessions/
├── latest                    # pointer file: contains one UUID, no newline
└── <uuid>/
    ├── task.json             # session record (see schema below)
    ├── output.log            # provider stdout (may be partial during run)
    └── error.log             # provider stderr + wrapper error messages
```

### File Permissions

| Path | Permissions |
|------|-------------|
| `~/.aco/sessions/` | `0700` |
| `~/.aco/sessions/<uuid>/` | `0700` |
| `task.json` | `0600` |
| `output.log` | `0600` |
| `error.log` | `0600` |
| `latest` | `0600` |

---

## `task.json` Schema

### TypeScript reference type (for installer compatibility)

```typescript
type SessionStatus = 'running' | 'done' | 'failed' | 'cancelled';
type PermissionProfile = 'default' | 'restricted' | 'unrestricted';
type ExitCause = 'exitCode' | 'signal';

interface TaskRecord {
  // Required: always present
  id: string;                    // UUID v4
  provider: string;              // "gemini" | "copilot"
  command: string;               // "review" | "adversarial" | "rescue"
  status: SessionStatus;
  startedAt: string;             // ISO 8601, UTC

  // Optional: present only when applicable
  pid?: number;                  // Provider process PID; set before first output byte
  permissionProfile?: PermissionProfile;  // default if not provided

  endedAt?: string;              // ISO 8601, UTC; set on terminal state

  // Terminal state: one of exitCode OR signal, never both, never neither
  // (except for status=cancelled which may have either or neither)
  exitCode?: number;             // 0 for done; non-zero for failed via exit
  signal?: string;               // signal name for failed via signal;
                                 // "timeout" for wrapper-initiated timeout;
                                 // "auth-failure" for auth error during invocation
}
```

### Go reference type

```go
type SessionStatus string

const (
    StatusRunning   SessionStatus = "running"
    StatusDone      SessionStatus = "done"
    StatusFailed    SessionStatus = "failed"
    StatusCancelled SessionStatus = "cancelled"
)

type TaskRecord struct {
    ID                string        `json:"id"`
    Provider          string        `json:"provider"`
    Command           string        `json:"command"`
    Status            SessionStatus `json:"status"`
    StartedAt         time.Time     `json:"startedAt"`

    PID               *int          `json:"pid,omitempty"`
    PermissionProfile string        `json:"permissionProfile,omitempty"`

    EndedAt           *time.Time    `json:"endedAt,omitempty"`
    ExitCode          *int          `json:"exitCode,omitempty"`
    Signal            *string       `json:"signal,omitempty"`
}
```

---

## State Machine

```
              create()
   ┌─────────────────────────────┐
   │                             ▼
   │                         [running]
   │                         /  |   \
   │               markDone /   |    \ markCancelled
   │                       /    |     \
   │                      ▼     |      ▼
   │                  [done]    |  [cancelled]
   │                            │
   │                     markFailed
   │                            │
   │                            ▼
   └──────────────────────── [failed]
```

### Invariants

- `pid` is set before first output byte (R-RUN-03)
- `endedAt` is set on all terminal state transitions
- Exactly one of `exitCode` or `signal` is set for `status=failed`
- `exitCode: 0` is set for `status=done`
- `status=cancelled` may have `exitCode` or `signal` if the process exited
  cleanly before the cancel signal reached it; or neither if the process was
  killed before exiting

---

## `latest` Pointer File

- Location: `~/.aco/sessions/latest`
- Content: exactly one UUID, no trailing newline
- Written atomically on every `SessionStore.Create()` call
- Read by `latestId()` — no directory scanning

### Write procedure (must be atomic)
1. Write UUID to `~/.aco/sessions/latest.tmp`
2. `os.Rename("~/.aco/sessions/latest.tmp", "~/.aco/sessions/latest")`

---

## `output.log`

- Appended as provider stdout chunks arrive (no buffering)
- Flushed before `markDone` / `markFailed` is called
- Preserved on cancellation (partial content is valid)
- May be empty if the provider produced no output before cancellation

## `error.log`

- Written by: provider stderr capture + wrapper error messages
- Format: raw text; multiple messages separated by newlines
- If auth failure is detected, the auth hint is appended to `error.log`
- If stderr is truncated for memory safety, a truncation notice is appended:
  `[stderr truncated at N bytes — see error.log for complete capture]`
  Note: full capture should be written; only the in-memory buffer is truncated

---

## Migration Compatibility Notes

> These notes are informational for migration only. They do NOT constrain the
> Go schema. The Go schema above is authoritative.

### Current Node.js schema gaps (do NOT replicate)

| Field | Current Node behavior | Go contract |
|-------|-----------------------|-------------|
| `exitCode` | Not recorded in `markFailed` | MUST be recorded |
| `signal` | Not recorded | MUST be recorded |
| `pid` | Written asynchronously | MUST be written before first output |

### Cross-binary compatibility window

During the migration period, both Node and Go binaries may read the same
session directories. The Node binary writes `task.json` without `exitCode` /
`signal`. The Go binary's reader must treat absent `exitCode` and `signal` as
"unknown" rather than an error, for sessions created by the Node binary.

After cutover (Node binary removed), this compatibility handling may be removed.
