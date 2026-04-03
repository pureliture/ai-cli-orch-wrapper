// Package session implements the session/task model defined in
// docs/contract/session-schema.md. All types here are normative —
// the Go wrapper runtime is the source of truth for the session format.
package session

import "time"

// SessionStatus represents the lifecycle state of a delegation session.
// Valid transitions: running → done | failed | cancelled.
// Once in a terminal state (done, failed, cancelled), no further transitions occur.
type SessionStatus string

const (
	StatusRunning   SessionStatus = "running"
	StatusDone      SessionStatus = "done"
	StatusFailed    SessionStatus = "failed"
	StatusCancelled SessionStatus = "cancelled"
)

// IsTerminal reports whether s is a terminal state (done, failed, or cancelled).
func (s SessionStatus) IsTerminal() bool {
	return s == StatusDone || s == StatusFailed || s == StatusCancelled
}

// TaskRecord is the canonical session record persisted as task.json.
// All field names match the JSON keys exactly — do not rename without updating
// the session-schema contract and the Node compatibility layer.
//
// Contract: docs/contract/session-schema.md
// Contract: docs/contract/runtime-contract.md R-PERSIST-*
type TaskRecord struct {
	// Required: always present.
	ID        string        `json:"id"`
	Provider  string        `json:"provider"`
	Command   string        `json:"command"`
	Status    SessionStatus `json:"status"`
	StartedAt time.Time     `json:"startedAt"`

	// Optional: present only when applicable.
	// PID is set before the first output byte (R-RUN-03, CPW-01).
	PID *int `json:"pid,omitempty"`

	// PermissionProfile is omitted when not explicitly set.
	// Empty string is treated as "not set", consistent with the Node schema.
	PermissionProfile string `json:"permissionProfile,omitempty"`

	// EndedAt is set when the session transitions to a terminal state.
	EndedAt *time.Time `json:"endedAt,omitempty"`

	// Terminal exit information: exactly one of ExitCode or Signal is present
	// for status=failed. Both absent is allowed for status=cancelled.
	// ExitCode: 0 is present for status=done (R-EXIT-02).
	// Signal: "timeout" for wrapper-initiated timeout (R-EXIT-03).
	// Signal: "auth-failure" for auth error during invocation (R-AUTH-02).
	ExitCode *int    `json:"exitCode,omitempty"`
	Signal   *string `json:"signal,omitempty"`
}

// intPtr returns a pointer to the given int value.
func intPtr(v int) *int { return &v }

// strPtr returns a pointer to the given string value.
func strPtr(s string) *string { return &s }

// timePtr returns a pointer to the given time value.
func timePtr(t time.Time) *time.Time { return &t }
