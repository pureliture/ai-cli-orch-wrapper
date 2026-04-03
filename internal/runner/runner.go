// Package runner defines the process execution interface for provider delegation.
//
// Phase 1: This package contains interfaces and stubs only.
// Phase 2 implements Run() with:
//   - context.WithTimeout for spawn timeout (R-RUN-09, CPW-02)
//   - Synchronous PID capture before io.Copy goroutines (R-RUN-03, CPW-01)
//   - Two goroutines for stdout tee and stderr capture (CPW-03)
//   - cmd.WaitDelay for SIGTERM→SIGKILL escalation (R-CANCEL-03, CPW-06)
//   - Typed error classification at the provider boundary (R-AUTH-04, CPW-13)
package runner

import (
	"context"
	"io"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/session"
)

// RunOpts configures a single provider invocation.
type RunOpts struct {
	Provider  provider.Provider
	Command   string
	Prompt    string
	Content   string
	SessionID string
	// TimeoutSecs is the maximum allowed duration for the provider process.
	// 0 means use the default (R-RUN-09: default 300s).
	TimeoutSecs int
	PermProfile provider.PermissionProfile
	// Store is used to record PID synchronously before streaming begins (R-RUN-03).
	// The Phase 2 runner calls store.SetPID(sessionID, pid) immediately after
	// cmd.Start() and before launching any io.Copy goroutines (CPW-01).
	Store *session.Store
	// Stdout is where provider stdout is tee'd alongside output.log (R-TEE-01).
	Stdout io.Writer
	// OutputLog is the path to the output.log file for the tee (R-TEE-01).
	// Symmetric with ErrorLog. The Phase 2 runner opens this file and passes it
	// to io.MultiWriter(opts.Stdout, outputFile).
	OutputLog string
	// ErrorLog is the path to write provider stderr (R-STDERR-01).
	ErrorLog string
}

// Runner executes provider processes and manages their lifecycle.
//
// Implementations must satisfy:
//   - R-RUN-03: PID persisted to task.json before first output byte
//   - R-RUN-09: timeout enforced via context.WithTimeout
//   - R-CANCEL-03: SIGTERM → WaitDelay → SIGKILL escalation
//   - CPW-01..09: ccg-workflow runtime parity
type Runner interface {
	// Run executes the provider process. It returns:
	//   - nil on success (provider exited 0)
	//   - *provider.AuthError on auth failure
	//   - *provider.ExitError on non-zero exit (non-auth)
	//   - *provider.TimeoutError on timeout
	//   - *provider.SignalError on signal termination
	Run(ctx context.Context, opts RunOpts) error
}

// StubRunner is a placeholder implementation for Phase 1.
// Phase 2 replaces this with the full process runner.
type StubRunner struct{}

func (StubRunner) Run(_ context.Context, _ RunOpts) error {
	return &provider.ExitError{
		Provider: "stub",
		ExitCode: 1,
		Stderr:   "runner not yet implemented (Phase 1 scaffold)",
	}
}
