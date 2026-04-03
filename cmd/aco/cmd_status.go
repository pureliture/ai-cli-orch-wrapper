package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/result"
)

// cmdStatus implements `aco status [--session <id>]`.
// Contract: R-STATUS-01..05
func cmdStatus(d *deps, args []string) int {
	fs := flag.NewFlagSet("status", flag.ContinueOnError)
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

	// R-STATUS-03: status only — no provider health checks
	return result.RenderStatus(os.Stdout, rec)
}
