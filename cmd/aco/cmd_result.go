package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/result"
)

// cmdResult implements `aco result [--session <id>]`.
// Contract: R-RESULT-01..06
func cmdResult(d *deps, args []string) int {
	fs := flag.NewFlagSet("result", flag.ContinueOnError)
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

	return result.RenderResult(
		os.Stdout,
		rec,
		d.store.OutputLogPath(sessionID),
		d.store.ErrorLogPath(sessionID),
	)
}
