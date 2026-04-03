package main

import (
	"flag"
	"fmt"
	"os"
	"syscall"
	"time"
)

const (
	sigkillDelay = 3 * time.Second // R-CANCEL-03: poll window before SIGKILL
	pidPollDelay = 1 * time.Second // R-CANCEL-05: poll for PID to appear
)

// cmdCancel implements `aco cancel [--session <id>]`.
// Contract: R-CANCEL-01..07, CPW-06, CPW-07, CPW-08, CPW-09
func cmdCancel(d *deps, args []string) int {
	fs := flag.NewFlagSet("cancel", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	sessionFlag := fs.String("session", "", "Session ID (default: latest)")
	if err := fs.Parse(args); err != nil {
		return 1
	}

	sessionID, err := resolveSession(d, *sessionFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}

	rec, err := d.store.Read(sessionID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Session not found: %s\n", sessionID)
		return 1
	}

	// R-CANCEL-02: already terminal — nothing to do
	if rec.Status.IsTerminal() {
		fmt.Fprintf(os.Stderr, "Session %s is already %s — nothing to cancel.\n", sessionID, rec.Status)
		return 0
	}

	// R-CANCEL-05: if PID not yet recorded, poll briefly for it to appear
	pid := rec.PID
	if pid == nil {
		pid = pollForPID(d, sessionID, pidPollDelay)
	}

	if pid != nil {
		sendWithEscalation(*pid)
	} else {
		// R-CANCEL-05: PID still absent after polling — mark cancelled without signaling
		fmt.Fprintf(os.Stderr, "warning: PID not yet recorded for session %s — marking cancelled without signal\n", sessionID)
	}

	if err := d.store.MarkCancelled(sessionID); err != nil {
		fmt.Fprintf(os.Stderr, "aco: mark cancelled: %v\n", err)
		return 1
	}

	// R-CANCEL-07
	fmt.Printf("Session %s cancelled.\n", sessionID)
	return 0
}

// sendWithEscalation sends SIGTERM to pid, then polls for exit for up to
// sigkillDelay, then sends SIGKILL (R-CANCEL-03, CPW-06).
func sendWithEscalation(pid int) {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return // process does not exist
	}

	// Phase 1: Send SIGTERM
	if err := proc.Signal(syscall.SIGTERM); err != nil {
		return // R-CANCEL-06: process already exited
	}

	// Poll for exit for sigkillDelay, then escalate to SIGKILL
	deadline := time.Now().Add(sigkillDelay)
	for time.Now().Before(deadline) {
		time.Sleep(50 * time.Millisecond)
		if !isProcessAlive(pid) {
			return // process exited cleanly after SIGTERM
		}
	}

	// SIGKILL escalation (CPW-06)
	_ = proc.Signal(syscall.SIGKILL)
}

// pollForPID reads task.json repeatedly until PID appears or timeout expires
// (R-CANCEL-05, CPW-09).
func pollForPID(d *deps, sessionID string, timeout time.Duration) *int {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		rec, err := d.store.Read(sessionID)
		if err == nil && rec.PID != nil {
			return rec.PID
		}
		time.Sleep(10 * time.Millisecond)
	}
	return nil
}

// isProcessAlive reports whether the process with the given PID is still running.
// Uses kill(pid, 0) which returns an error if the process does not exist.
func isProcessAlive(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = proc.Signal(syscall.Signal(0))
	return err == nil
}

// resolveSession returns the session ID from the flag or the latest pointer.
// Extracted here to be shared by status, result, and cancel commands.
func resolveSession(d *deps, flag string) (string, error) {
	if flag != "" {
		return flag, nil
	}
	id, err := d.store.LatestID()
	if err != nil {
		return "", fmt.Errorf("no sessions found: %w", err)
	}
	if id == "" {
		return "", fmt.Errorf("no sessions found")
	}
	return id, nil
}
