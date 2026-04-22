// Package runner implements the provider process execution layer.
//
// Reference: ccg-workflow/codeagent-wrapper/executor.go
//   - Context setup:    lines 966-969
//   - Start + wait:     lines 1110-1139
//   - Wait loop:        lines 1157-1213 (simplified — no JSON parser, no Windows)
//   - forwardSignals:   lines 1322-1358
//   - terminateCommand: lines 1431-1467
//   - forceKillTimer:   lines 1391-1407
package runner

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
)

const maxStderrBytes = 64 * 1024

// envAllowlist defines which environment variables are passed to providers.
// This prevents sensitive environment variables (API keys, tokens, etc.)
// from being exposed to provider processes, while allowing provider-specific
// auth variables needed for CI/headless operation.
var envAllowlist = map[string]bool{
	"ACO_TIMEOUT_SECONDS": true,
	"PATH":                true,
	"HOME":                true,
	"USER":                true,
	"TERM":                true,
	"LANG":                true,
	"LC_ALL":              true,
	// Provider auth variables for CI/headless operation
	"GEMINI_API_KEY":  true,
	"GITHUB_TOKEN":    true,
	"ANTHROPIC_API_KEY": true,
}

// filterEnvForAllowlist filters environment variables to only those in the allowlist.
func filterEnvForAllowlist(env []string) []string {
	var filtered []string
	for _, e := range env {
		// Split on first '=' to get the key
		idx := strings.Index(e, "=")
		if idx <= 0 {
			continue
		}
		key := e[:idx]
		if envAllowlist[key] {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

// forceKillDelaySecs is the delay between SIGTERM and SIGKILL.
// Reference: ccg-workflow main.go:67 — default 5, stored as atomic int32.
// Tests can override via forceKillDelaySecs.Store(N).
var forceKillDelaySecs atomic.Int32

func init() {
	forceKillDelaySecs.Store(5)
}

// SetForceKillDelay overrides the delay between SIGTERM and SIGKILL.
// Exported for use in tests. Not safe for concurrent use outside of tests.
func SetForceKillDelay(secs int32) {
	forceKillDelaySecs.Store(secs)
}

// ForceKillDelay returns the current forceKillDelaySecs value.
// Exported for use in tests.
func ForceKillDelay() int32 {
	return forceKillDelaySecs.Load()
}

// ProcessRunner executes provider processes using the ccg-workflow blocking model.
// Each Run call is a single blocking invocation: spawn, stream stdout, exit.
type ProcessRunner struct{}

// Run executes the provider binary and streams stdout to opts.Stdout.
//
// Signal handling:
//   - OS SIGTERM/SIGINT → forwardSignals forwards to child via proc.Signal(SIGTERM)
//     then schedules SIGKILL after forceKillDelaySecs if child does not exit
//   - Timeout → ctx.Done() → terminateCommand (same SIGTERM + SIGKILL pattern)
//
// No cmd.WaitDelay — reference executor.go does not use it.
// Setpgid is used to place the provider and all its children in a new process group.
// This is a necessary deviation from ccg-workflow to ensure Node.js CLIs (Gemini, Copilot)
// and their spawned workers are properly terminated without orphaning pipes.
// No session files — blocking model, stdout streams inline.
func (ProcessRunner) Run(ctx context.Context, opts RunOpts) (RunResult, error) {
	timeoutSecs := opts.TimeoutSecs
	if timeoutSecs <= 0 {
		timeoutSecs = 300
	}
	start := time.Now()

	// executor.go:966-967: wrap with timeout context.
	ctx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
	defer cancel()

	args := opts.Provider.BuildArgs(opts.Command, opts.Prompt, opts.Content, provider.InvokeOpts{
		PermissionProfile: opts.PermProfile,
		TimeoutSecs:       timeoutSecs,
		Model:             opts.Model,
		ReasoningEffort:   opts.ReasoningEffort,
		ExtraArgs:         append([]string(nil), opts.LaunchArgs...),
	})

	// exec.Command (not CommandContext) — termination is controlled explicitly via
	// forwardSignals + terminateCommand. Go's context-kill mechanism is not used.
	cmd := exec.Command(opts.Provider.Binary(), args...)
	if opts.WorkDir != "" {
		cmd.Dir = opts.WorkDir
	} else {
		cmd.Dir = "."
	}
	cmd.Env = os.Environ()
	// Filter environment variables to allowlist for security
	cmd.Env = filterEnvForAllowlist(cmd.Env)
	// Setpgid places the provider and all its children in a new process group.
	// forwardSignals and terminateCommand send signals to the whole group via
	// syscall.Kill(-pgid, ...) so that children holding stdout pipes are also
	// killed and cmd.Wait() can return.
	// ccg-workflow does not use Setpgid; we need it because gemini is a
	// Node.js CLI that spawns workers which would otherwise orphan the pipe.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stderrBuf := newTailBuffer(maxStderrBytes)
	cmd.Stderr = &stderrBuf

	out := opts.Stdout
	if out == nil {
		out = io.Discard
	}
	cmd.Stdout = out

	// executor.go:1110-1122: start the provider process.
	if err := cmd.Start(); err != nil {
		return RunResult{ExitCode: 1, Duration: time.Since(start)}, classifyStartError(opts.Provider, err)
	}

	// executor.go:1138-1139: wait goroutine.
	waitCh := make(chan error, 1)
	go func() { waitCh <- cmd.Wait() }()

	// done is closed when cmd.Wait() returns, notifying forwardSignals to cancel
	// any pending SIGKILL timer and exit its goroutine without waiting for ctx.Done().
	done := make(chan struct{})
	defer close(done)

	// executor.go:1322-1358: forward OS signals (SIGTERM/SIGINT) to the child.
	// Must be called after cmd.Start() so cmd.Process is non-nil.
	forwardSignals(ctx, cmd.Process, done, func(s string) {
		fmt.Fprintln(os.Stderr, s)
	})

	// Wait loop — simplified from executor.go:1157-1213.
	// Omitted: messageSeen/completeSeen (JSON parser output), fallback exit timer (Windows).
	var (
		waitErr    error
		fkt        *forceKillTimer
		terminated bool
	)
waitLoop:
	for {
		select {
		case waitErr = <-waitCh:
			break waitLoop
		case <-ctx.Done():
			// Timeout path. OS signal path is handled by forwardSignals goroutine.
			if !terminated {
				fkt = terminateCommand(cmd.Process)
				terminated = true
			}
			waitErr = <-waitCh
			break waitLoop
		}
	}

	if fkt != nil {
		fkt.Stop()
	}

	result, err := classifyWaitError(ctx, opts.Provider, timeoutSecs, stderrBuf.String(), waitErr)
	result.Duration = time.Since(start)
	return result, err
}

type tailBuffer struct {
	limit int
	buf   []byte
}

func newTailBuffer(limit int) tailBuffer {
	return tailBuffer{limit: limit}
}

func (b *tailBuffer) Write(p []byte) (int, error) {
	if b.limit <= 0 {
		return len(p), nil
	}
	if len(p) >= b.limit {
		b.buf = append(b.buf[:0], p[len(p)-b.limit:]...)
		return len(p), nil
	}
	needed := len(b.buf) + len(p) - b.limit
	if needed > 0 {
		b.buf = append([]byte(nil), b.buf[needed:]...)
	}
	b.buf = append(b.buf, p...)
	return len(p), nil
}

func (b *tailBuffer) String() string {
	return string(b.buf)
}

// forwardSignals forwards SIGINT/SIGTERM from the OS to the child process.
//
// Copied from executor.go:1322-1358.
// Adapted: uses *os.Process instead of commandRunner interface.
// Darwin/Linux only — Windows killProcessTree omitted.
//
// done must be closed when cmd.Wait() returns. This allows the goroutine to
// exit immediately on normal process exit (fixing a goroutine leak) and to
// cancel the scheduled SIGKILL if the child exits promptly after SIGTERM
// (preventing a stale SIGKILL against a recycled PGID).
func forwardSignals(ctx context.Context, proc *os.Process, done <-chan struct{}, logErrFn func(string)) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		defer signal.Stop(sigCh)
		select {
		case sig := <-sigCh:
			logErrFn(fmt.Sprintf("Received signal: %v", sig))
			if proc != nil {
				// executor.go:1347-1352: SIGTERM first, then schedule SIGKILL.
				// Use time.NewTimer (not AfterFunc) so the kill can be cancelled
				// if the child exits before the delay expires.
				_ = killProcessGroup(proc, syscall.SIGTERM)
				t := time.NewTimer(time.Duration(forceKillDelaySecs.Load()) * time.Second)
				select {
				case <-t.C:
					_ = killProcessGroup(proc, syscall.SIGKILL)
				case <-done:
					t.Stop() // child exited — cancel scheduled SIGKILL
				}
			}
		case <-ctx.Done():
		case <-done:
		}
	}()
}

// terminateCommand sends SIGTERM to proc and schedules SIGKILL after forceKillDelaySecs.
//
// Copied from executor.go:1431-1467.
// Adapted: uses *os.Process instead of commandRunner interface.
// Darwin/Linux only — Windows killProcessTree omitted.
func terminateCommand(proc *os.Process) *forceKillTimer {
	if proc == nil {
		return nil
	}

	// executor.go:1451
	_ = killProcessGroup(proc, syscall.SIGTERM)

	// executor.go:1454-1464
	done := make(chan struct{}, 1)
	timer := time.AfterFunc(time.Duration(forceKillDelaySecs.Load())*time.Second, func() {
		_ = killProcessGroup(proc, syscall.SIGKILL)
		close(done)
	})

	return &forceKillTimer{timer: timer, done: done}
}

// forceKillTimer tracks the scheduled SIGKILL AfterFunc.
// Copied from executor.go:1391-1407.
type forceKillTimer struct {
	timer *time.Timer
	done  chan struct{}
}

// Stop cancels the SIGKILL timer if it has not fired yet.
// If it has already fired, Stop blocks until proc.Kill() completes.
func (t *forceKillTimer) Stop() {
	if t == nil || t.timer == nil {
		return
	}
	// executor.go:1402-1405: drain done if timer already fired.
	if !t.timer.Stop() {
		<-t.done
	}
}

func killProcessGroup(proc *os.Process, sig syscall.Signal) error {
	if proc == nil {
		return nil
	}
	return syscall.Kill(-proc.Pid, sig)
}

// classifyStartError converts cmd.Start() errors to typed provider errors.
func classifyStartError(prov provider.Provider, err error) error {
	if errors.Is(err, exec.ErrNotFound) ||
		strings.Contains(err.Error(), "executable file not found") ||
		strings.Contains(err.Error(), "no such file or directory") {
		return &provider.NotFoundError{
			Provider:    prov.Name(),
			InstallHint: prov.InstallHint(),
		}
	}
	return fmt.Errorf("runner: start %q: %w", prov.Binary(), err)
}

// classifyWaitError converts cmd.Wait() errors to typed provider errors.
func classifyWaitError(ctx context.Context, prov provider.Provider, timeoutSecs int, stderr string, err error) (RunResult, error) {
	if err == nil {
		return RunResult{ExitCode: 0, ProviderExited: true}, nil
	}

	// Timeout: context deadline exceeded before process exited.
	if ctx.Err() == context.DeadlineExceeded {
		return RunResult{ExitCode: 1}, &provider.TimeoutError{
			Provider:    prov.Name(),
			TimeoutSecs: timeoutSecs,
		}
	}

	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		return RunResult{ExitCode: 1}, &provider.ExitError{Provider: prov.Name(), ExitCode: 1, Stderr: stderr}
	}

	exitCode := exitErr.ExitCode()

	// Signal termination (SIGTERM from forwardSignals/terminateCommand, or SIGKILL from AfterFunc).
	if status, ok := exitErr.Sys().(syscall.WaitStatus); ok && status.Signaled() {
		return RunResult{ExitCode: 1}, &provider.SignalError{
			Provider: prov.Name(),
			Signal:   status.Signal().String(),
		}
	}

	// Auth failure (provider-specific heuristic).
	if prov.IsAuthFailure(exitCode, stderr) {
		return RunResult{ExitCode: exitCode, ProviderExited: true}, &provider.AuthError{Provider: prov.Name(), Hint: prov.AuthHint()}
	}

	// Generic non-zero exit.
	return RunResult{ExitCode: exitCode, ProviderExited: true}, &provider.ExitError{Provider: prov.Name(), ExitCode: exitCode, Stderr: stderr}
}
