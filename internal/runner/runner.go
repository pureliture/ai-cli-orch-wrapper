// Package runner defines the process execution interface for provider delegation.
//
// TRANSITIONAL: This package will be rewritten in Phase B to copy
// ccg-workflow's executor pattern directly:
//   - forwardSignals():   signal.NotifyContext + proc.Signal(SIGTERM) + time.AfterFunc(5s, proc.Kill)
//   - terminateCommand(): proc.Signal(SIGTERM) + time.AfterFunc(forceKillDelay, proc.Kill)
//
// Reference: reference/ccg-workflow/codeagent-wrapper/executor.go
//   - forwardSignals:    lines 1322-1358
//   - terminateCommand:  lines 1431-1467
//
// DO NOT extend this file. Rewrite in Phase B.
package runner

import (
	"context"
	"io"
	"time"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
)

// RunOpts configures a single provider invocation.
//
// TRANSITIONAL: SessionID, OutputLog, ErrorLog, Store removed —
// session persistence is deleted. Phase B will further simplify this.
type RunOpts struct {
	Provider    provider.Provider
	Command     string
	Prompt      string
	Content     string
	Model       string
	LaunchArgs  []string
	WorkDir     string
	ReasoningEffort string
	TimeoutSecs int
	PermProfile provider.PermissionProfile
	// Stdout is where provider stdout is streamed (blocking, no tee to file).
	Stdout io.Writer
}

// RunResult describes the outcome of a provider invocation.
type RunResult struct {
	ExitCode       int
	Duration       time.Duration
	ProviderExited bool
}

// Runner executes provider processes and manages their lifecycle.
//
// TRANSITIONAL: Interface contract will be rewritten in Phase B to match
// ccg-workflow's blocking execution model.
type Runner interface {
	Run(ctx context.Context, opts RunOpts) (RunResult, error)
}

// StubRunner is a placeholder. Phase B replaces with ccg-workflow executor copy.
type StubRunner struct{}

func (StubRunner) Run(_ context.Context, _ RunOpts) (RunResult, error) {
	return RunResult{ExitCode: 1}, &provider.ExitError{
		Provider: "stub",
		ExitCode: 1,
		Stderr:   "runner not yet implemented — rewrite in Phase B",
	}
}
