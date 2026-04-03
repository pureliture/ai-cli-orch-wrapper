package runner

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
)

// sigkillDelay is the time between SIGTERM and SIGKILL (CPW-06, R-CANCEL-03).
const sigkillDelay = 3 * time.Second

// Note on process group kill (Setpgid: true):
// The provider process and all its children are placed in a new process group.
// On timeout/context-cancel, we send SIGTERM then SIGKILL to the ENTIRE group
// (via syscall.Kill(-pgid, ...)). This ensures that even if the provider spawns
// subprocesses that hold the stdout pipe write end open, those processes are
// killed and the pipe closes, unblocking Go's internal goroutines and allowing
// cmd.Wait() to return.
//
// Trade-off: with Setpgid, the provider process group does not receive SIGHUP
// when the terminal session ends. For delegation CLIs (gemini, copilot) running
// inside Claude Code sessions, this is acceptable — aco cancel handles cleanup.
// This supersedes the R-SPAWN-05 SHOULD-NOT guideline, which is overridden here
// because reliable process lifecycle requires it (CPW-06, R-CANCEL-03).
//
// Note on cmd.Stdout vs StdoutPipe:
// cmd.Stdout = MultiWriter is used (not StdoutPipe). The Go runtime manages
// the copy goroutines internally. With Setpgid + group kill, all orphaned
// children are killed, closing all pipe write ends, unblocking the goroutines.

// lockedWriter serialises writes to w using mu. Although cmd.Stderr is written
// by a single Go-internal copy goroutine, the mutex is retained for safety
// against future callers that pass a shared writer.
type lockedWriter struct {
	mu sync.Mutex
	w  io.Writer
}

func (lw *lockedWriter) Write(p []byte) (int, error) {
	lw.mu.Lock()
	defer lw.mu.Unlock()
	return lw.w.Write(p)
}

// ProcessRunner is the real provider process runner that replaces StubRunner.
//
// ccg-workflow parity implemented:
//   - CPW-01: PID captured synchronously between cmd.Start() and any io.Copy
//   - CPW-02: context.WithTimeout wraps the entire run
//   - CPW-03: stdout and stderr consumed in Go-managed goroutines — no deadlock
//   - CPW-04: outputFile.Close() called before markDone is in the caller
//   - CPW-06: cmd.WaitDelay implements SIGTERM→SIGKILL escalation correctly
//   - CPW-13: typed errors at provider boundary
type ProcessRunner struct{}

// Run executes the provider binary and returns a typed error on failure.
//
// Execution sequence (contract-critical ordering):
//  1. Open output.log and error.log (0600).
//  2. Set cmd.Stdout = MultiWriter(opts.Stdout, outputFile) — real-time tee.
//  3. Set cmd.Stderr = MultiWriter(errorFile, stderrCapture).
//  4. cmd.WaitDelay = 3s — SIGTERM→SIGKILL on context cancellation.
//  5. cmd.Start() — forks process; Go starts internal copy goroutines.
//  6. [SYNCHRONOUS] Store.SetPID() — R-RUN-03, CPW-01.
//  7. cmd.Wait() — blocks until process exits AND internal goroutines complete.
//     WaitDelay fires if context is cancelled and process doesn't exit.
//  8. Close files (R-TEE-03).
//  9. Classify error (R-AUTH-04, CPW-13).
func (ProcessRunner) Run(ctx context.Context, opts RunOpts) error {
	timeoutSecs := opts.TimeoutSecs
	if timeoutSecs <= 0 {
		timeoutSecs = 300
	}
	ctx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
	defer cancel()

	args := opts.Provider.BuildArgs(opts.Command, opts.Prompt, opts.Content, provider.InvokeOpts{
		PermissionProfile: opts.PermProfile,
		SessionID:         opts.SessionID,
		TimeoutSecs:       timeoutSecs,
	})

	cmd := exec.CommandContext(ctx, opts.Provider.Binary(), args...)
	cmd.Dir = "."          // inherit cwd (R-SPAWN-03)
	cmd.Env = os.Environ() // inherit env (R-SPAWN-02)
	cmd.WaitDelay = sigkillDelay
	// Place the provider in a new process group so that group kill covers
	// all children (prevents orphaned processes from keeping pipes open).
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	// Open log files before spawn (0600, R-TEE-02, R-STDERR-02).
	outputFile, err := os.OpenFile(opts.OutputLog, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return fmt.Errorf("runner: open output.log: %w", err)
	}
	defer outputFile.Close()

	errorFile, err := os.OpenFile(opts.ErrorLog, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return fmt.Errorf("runner: open error.log: %w", err)
	}
	defer errorFile.Close()

	// stderr capture: tee to file and in-memory buffer for error classification.
	var stderrBuf strings.Builder
	stderrWriter := &lockedWriter{}
	stderrWriter.w = io.MultiWriter(errorFile, &stderrBuf)

	// Assign stdout/stderr to cmd. Go internally manages the copy goroutines,
	// which means WaitDelay correctly applies to them (CPW-06).
	// cmd.Stdout = MultiWriter implements the real-time tee (R-TEE-01, CPW-03).
	cmd.Stdout = io.MultiWriter(opts.Stdout, outputFile)
	cmd.Stderr = stderrWriter

	// Stdin is nil → /dev/null → provider binaries do not wait for input (R-SPAWN-04).

	if err := cmd.Start(); err != nil {
		return classifyStartError(opts.Provider, err)
	}

	// Group kill timers: send SIGTERM then SIGKILL to the provider's process
	// group. This ensures orphaned children (which could keep pipes open) are
	// also killed when the context expires.
	//
	// We use time.AfterFunc with explicit delays rather than ctx.Done() to avoid
	// any goroutine scheduling issues with context cancellation signals.
	pgid := cmd.Process.Pid // Setpgid: true → pgid == pid at spawn time
	timeoutDur := time.Duration(timeoutSecs) * time.Second
	sigtermTimer := time.AfterFunc(timeoutDur, func() {
		_ = syscall.Kill(-pgid, syscall.SIGTERM)
	})
	sigkillTimer := time.AfterFunc(timeoutDur+sigkillDelay, func() {
		_ = syscall.Kill(-pgid, syscall.SIGKILL)
	})

	// ── CPW-01 / R-RUN-03: PID persisted synchronously ──
	// cmd.Start() has returned; cmd.Process.Pid is set. The Go-internal copy
	// goroutines have started but in practice no data is consumed yet (the process
	// must first parse flags and connect to a network). This is a best-effort
	// structural guarantee: there is no hard happens-before between SetPID and the
	// first write to opts.Stdout, because no synchronization primitive enforces it.
	// For provider CLIs that produce output only after network round-trips, the race
	// window is negligible. If a strict guarantee is required, use cmd.StdoutPipe
	// and drain manually — but see the WaitDelay deadlock note at the top of this file.
	if opts.Store != nil && opts.SessionID != "" {
		if pidErr := opts.Store.SetPID(opts.SessionID, cmd.Process.Pid); pidErr != nil {
			// Non-fatal: degraded cancellation (R-CANCEL-05 path) if PID absent.
			fmt.Fprintf(os.Stderr, "runner: warning: set PID: %v\n", pidErr)
		}
	}

	// cmd.Wait() blocks until the process exits and goroutines complete.
	// The AfterFunc timers above ensure the process group is killed on timeout.
	waitErr := cmd.Wait()

	// Cancel timers if the process exited cleanly before timeout.
	sigtermTimer.Stop()
	sigkillTimer.Stop()

	// Files are closed by defer; explicit close here ensures flush before
	// the caller calls MarkDone (R-TEE-03, CPW-04).
	outputFile.Close()
	errorFile.Close()

	return classifyWaitError(ctx, opts.Provider, timeoutSecs, stderrBuf.String(), waitErr)
}

// classifyStartError converts cmd.Start() errors to typed errors (CPW-13).
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

// classifyWaitError converts cmd.Wait() errors to typed provider errors
// (CPW-13, R-AUTH-04, R-EXIT-01..03).
func classifyWaitError(ctx context.Context, prov provider.Provider, timeoutSecs int, stderr string, err error) error {
	if err == nil {
		return nil // R-RUN-06: clean exit
	}

	// Timeout: context deadline exceeded (R-EXIT-03). Check before ExitError
	// because a SIGKILL-terminated process also returns ExitError; the
	// context state distinguishes a wrapper-initiated timeout from an external kill.
	if ctx.Err() == context.DeadlineExceeded {
		return &provider.TimeoutError{
			Provider:    prov.Name(),
			TimeoutSecs: timeoutSecs,
		}
	}

	var exitErr *exec.ExitError
	if !errors.As(err, &exitErr) {
		return &provider.ExitError{Provider: prov.Name(), ExitCode: 1, Stderr: stderr}
	}

	exitCode := exitErr.ExitCode()

	// Signal termination (external kill or aco cancel, R-RUN-08).
	// Checked before auth: SIGKILL from aco cancel is not an auth failure.
	if status, ok := exitErr.Sys().(syscall.WaitStatus); ok && status.Signaled() {
		return &provider.SignalError{
			Provider: prov.Name(),
			Signal:   status.Signal().String(),
		}
	}

	// Auth failure (R-AUTH-04, CPW-13).
	if prov.IsAuthFailure(exitCode, stderr) {
		return &provider.AuthError{Provider: prov.Name(), Hint: prov.AuthHint()}
	}

	// Generic non-zero exit (R-RUN-07, R-EXIT-01).
	return &provider.ExitError{Provider: prov.Name(), ExitCode: exitCode, Stderr: stderr}
}
