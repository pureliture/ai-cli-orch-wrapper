// Package provider defines the provider interface and typed error hierarchy
// for the aco delegation runtime.
//
// Contract: docs/contract/runtime-contract.md R-AUTH-01, R-AUTH-04
package provider

import "fmt"

// NotFoundError is returned when the provider binary is not present in PATH.
// The session MUST NOT be created before this error is returned (R-AVAIL-02).
type NotFoundError struct {
	Provider    string
	InstallHint string
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("provider %q not found in PATH\n  Install: %s", e.Provider, e.InstallHint)
}

// AuthError is returned when the provider binary is found but authentication
// has failed during invocation (R-AUTH-02, R-AUTH-04).
// The session is marked failed with signal "auth-failure".
type AuthError struct {
	Provider string
	Hint     string
}

func (e *AuthError) Error() string {
	if e.Hint != "" {
		return fmt.Sprintf("provider %q: authentication required\n  %s", e.Provider, e.Hint)
	}
	return fmt.Sprintf("provider %q: authentication required", e.Provider)
}

// ExitError is returned when the provider process exits with a non-zero code
// that does not match auth failure heuristics (R-AUTH-04, R-RUN-07).
type ExitError struct {
	Provider string
	ExitCode int
	Stderr   string
}

func (e *ExitError) Error() string {
	if e.Stderr != "" {
		return fmt.Sprintf("provider %q: exited with code %d\n%s", e.Provider, e.ExitCode, e.Stderr)
	}
	return fmt.Sprintf("provider %q: exited with code %d", e.Provider, e.ExitCode)
}

// TimeoutError is returned when the provider process exceeds the spawn timeout
// (R-RUN-09, R-EXIT-03). The session is marked failed with signal "timeout".
type TimeoutError struct {
	Provider    string
	TimeoutSecs int
}

func (e *TimeoutError) Error() string {
	return fmt.Sprintf("provider %q: timed out after %ds", e.Provider, e.TimeoutSecs)
}

// SignalError is returned when the provider process is killed by an OS signal
// during normal execution (R-RUN-08).
type SignalError struct {
	Provider string
	Signal   string
}

func (e *SignalError) Error() string {
	return fmt.Sprintf("provider %q: terminated by signal %s", e.Provider, e.Signal)
}
