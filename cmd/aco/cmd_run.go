package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"strconv"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/prompt"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/session"
)

const defaultTimeoutSecs = 300 // R-RUN-09: default 300 seconds

// cmdRun implements `aco run <provider> <command>`.
//
// Phase 1: session creation and lifecycle are fully implemented.
// The provider invocation is stubbed via runner.StubRunner.
// Phase 2 replaces StubRunner with the real process runner.
func cmdRun(d *deps, args []string) int {
	// Parse args manually to allow flags in any position relative to positional
	// args (flag.FlagSet stops at the first non-flag, which would miss flags
	// placed after "gemini review").
	var (
		inputFlag   string
		profileFlag = "default"
		timeoutFlag int
		positional  []string
	)
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--input" || a == "-input":
			if i+1 < len(args) {
				inputFlag = args[i+1]
				i++
			}
		case a == "--permission-profile" || a == "-permission-profile":
			if i+1 < len(args) {
				profileFlag = args[i+1]
				i++
			}
		case a == "--timeout" || a == "-timeout":
			if i+1 < len(args) {
				if v, err := strconv.Atoi(args[i+1]); err == nil {
					timeoutFlag = v
				}
				i++
			}
		case len(a) > 0 && a[0] != '-':
			positional = append(positional, a)
		}
	}

	if len(positional) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: aco run <provider> <command> [--input <text>] [--permission-profile default|restricted|unrestricted] [--timeout <secs>]")
		return 1
	}

	providerKey := positional[0]
	command := positional[1]

	// Validate permission profile
	profile := provider.PermissionProfile(profileFlag)
	switch profile {
	case provider.ProfileDefault, provider.ProfileRestricted, provider.ProfileUnrestricted:
	default:
		fmt.Fprintf(os.Stderr, "invalid --permission-profile %q: must be default|restricted|unrestricted\n", profileFlag)
		return 1
	}

	// Resolve timeout: flag > ACO_TIMEOUT_SECONDS env > default (R-RUN-09)
	timeoutSecs := timeoutFlag
	if timeoutSecs == 0 {
		if env := os.Getenv("ACO_TIMEOUT_SECONDS"); env != "" {
			if v, err := strconv.Atoi(env); err == nil && v > 0 {
				timeoutSecs = v
			}
		}
	}
	if timeoutSecs <= 0 {
		timeoutSecs = defaultTimeoutSecs
	}

	// R-RUN-01: check provider availability before creating session
	prov, err := d.registry.Get(providerKey)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if !prov.IsAvailable() {
		fmt.Fprintf(os.Stderr, "provider %q not found in PATH\n  Install: %s\n", providerKey, prov.InstallHint())
		return 1
	}

	// Read content from --input or stdin
	content := inputFlag
	if content == "" && !isTerminal(os.Stdin) {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			fmt.Fprintf(os.Stderr, "aco: read stdin: %v\n", err)
			return 1
		}
		content = string(data)
	}

	// Load prompt (R-RUN-12)
	cwd, _ := os.Getwd()
	promptText, err := prompt.Load(cwd, providerKey, command)
	if err != nil {
		fmt.Fprintf(os.Stderr, "aco: load prompt: %v\n", err)
		return 1
	}

	// R-RUN-02: create session before spawning the provider
	rec, err := d.store.Create(providerKey, command, string(profile))
	if err != nil {
		fmt.Fprintf(os.Stderr, "aco: create session: %v\n", err)
		return 1
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Invoke the runner. Phase 1: StubRunner returns an error immediately.
	// Phase 2: real runner streams output, records PID synchronously, and
	// enforces timeout + SIGTERM→SIGKILL escalation.
	runErr := d.runner.Run(ctx, runner.RunOpts{
		Provider:    prov,
		Command:     command,
		Prompt:      promptText,
		Content:     content,
		SessionID:   rec.ID,
		TimeoutSecs: timeoutSecs,
		PermProfile: profile,
		Store:       d.store,
		Stdout:      os.Stdout,
		OutputLog:   d.store.OutputLogPath(rec.ID),
		ErrorLog:    d.store.ErrorLogPath(rec.ID),
	})

	if runErr != nil {
		// Re-read the session to check if aco cancel already marked it cancelled.
		// If so, do not overwrite the cancellation with a signal/failure status —
		// the cancel command won the race (R-CANCEL-04).
		if current, readErr := d.store.Read(rec.ID); readErr == nil && current.Status == session.StatusCancelled {
			// Session was cancelled externally. Suppress the signal error.
			return 1
		}

		// Classify and record the failure.
		switch e := runErr.(type) {
		case *provider.AuthError:
			_ = d.store.MarkFailedWithSignal(rec.ID, "auth-failure")
			_ = appendErrorLog(d.store.ErrorLogPath(rec.ID), e.Error())
		case *provider.TimeoutError:
			_ = d.store.MarkFailedWithSignal(rec.ID, "timeout")
			_ = appendErrorLog(d.store.ErrorLogPath(rec.ID), e.Error())
		case *provider.SignalError:
			_ = d.store.MarkFailedWithSignal(rec.ID, e.Signal)
			_ = appendErrorLog(d.store.ErrorLogPath(rec.ID), e.Error())
		case *provider.ExitError:
			_ = d.store.MarkFailed(rec.ID, e.ExitCode)
			if e.Stderr != "" {
				_ = appendErrorLog(d.store.ErrorLogPath(rec.ID), e.Stderr)
			}
		default:
			_ = d.store.MarkFailed(rec.ID, 1)
			_ = appendErrorLog(d.store.ErrorLogPath(rec.ID), runErr.Error())
		}
		fmt.Fprintf(os.Stderr, "Error: %v\n", runErr)
		return 1
	}

	if err := d.store.MarkDone(rec.ID); err != nil {
		fmt.Fprintf(os.Stderr, "aco: mark done: %v\n", err)
		return 1
	}
	return 0
}

// isTerminal reports whether f is an interactive terminal.
func isTerminal(f *os.File) bool {
	fi, err := f.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}

// appendErrorLog appends msg to the error.log for the session (R-PERSIST-03: 0600).
func appendErrorLog(path, msg string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = fmt.Fprintln(f, msg)
	return err
}
