// Package result renders aco result output based on session lifecycle state.
//
// Contract: docs/contract/runtime-contract.md R-RESULT-01..06
package result

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/session"
)

// ExitCode returns the process exit code that aco result should use
// for the given session status (R-STATUS-04, R-RESULT-02..05).
func ExitCode(status session.SessionStatus) int {
	switch status {
	case session.StatusDone:
		return 0
	case session.StatusFailed:
		return 1
	case session.StatusCancelled:
		return 2
	case session.StatusRunning:
		return 3
	default:
		return 1
	}
}

// RenderResult writes the aco result output to out for the given session.
// outputLog is the path to output.log; errorLog is the path to error.log.
// Returns the exit code that aco result should exit with.
func RenderResult(out io.Writer, rec *session.TaskRecord, outputLogPath, errorLogPath string) int {
	outputContent := readFileOrEmpty(outputLogPath)

	switch rec.Status {
	case session.StatusRunning:
		// R-RESULT-02: partial output + banner
		fmt.Fprintf(out, "⟳ Session %s is still running — partial output below\n", rec.ID)
		if outputContent != "" {
			fmt.Fprint(out, outputContent)
		}
		return 3

	case session.StatusDone:
		// R-RESULT-03: full output.log
		fmt.Fprint(out, outputContent)
		return 0

	case session.StatusFailed:
		// R-RESULT-04: output.log + error.log with separator
		fmt.Fprint(out, outputContent)
		if errContent := readFileOrEmpty(errorLogPath); errContent != "" {
			fmt.Fprint(out, "\n--- error ---\n")
			fmt.Fprint(out, errContent)
		}
		return 1

	case session.StatusCancelled:
		// R-RESULT-05: partial output + banner
		fmt.Fprintf(out, "✗ Session %s was cancelled — partial output below\n", rec.ID)
		if outputContent != "" {
			fmt.Fprint(out, outputContent)
		}
		return 2

	default:
		fmt.Fprintf(out, "unknown session status: %s\n", rec.Status)
		return 1
	}
}

// RenderStatus writes the aco status output to out.
// Follows the field:value format defined in R-STATUS-02.
// Returns the exit code that aco status should exit with (R-STATUS-04).
func RenderStatus(out io.Writer, rec *session.TaskRecord) int {
	fmt.Fprintf(out, "Session:    %s\n", rec.ID)
	fmt.Fprintf(out, "Provider:   %s\n", rec.Provider)
	fmt.Fprintf(out, "Command:    %s\n", rec.Command)
	fmt.Fprintf(out, "Status:     %s\n", rec.Status)
	fmt.Fprintf(out, "Started:    %s\n", rec.StartedAt.Format("2006-01-02T15:04:05Z"))

	if rec.EndedAt != nil {
		fmt.Fprintf(out, "Ended:      %s\n", rec.EndedAt.Format("2006-01-02T15:04:05Z"))
	}
	if rec.Status == session.StatusRunning && rec.PID != nil {
		fmt.Fprintf(out, "PID:        %d\n", *rec.PID)
	}
	if rec.ExitCode != nil {
		fmt.Fprintf(out, "ExitCode:   %d\n", *rec.ExitCode)
	} else if rec.Status == session.StatusFailed && rec.Signal == nil {
		// R-STATUS-05: Node-created failed sessions may lack both exitCode and signal.
		// Only applies to StatusFailed — cancelled sessions legitimately have neither.
		fmt.Fprintf(out, "ExitCode:   unknown\n")
	}
	if rec.Signal != nil {
		fmt.Fprintf(out, "Signal:     %s\n", *rec.Signal)
	}
	if rec.PermissionProfile != "" {
		fmt.Fprintf(out, "Permission: %s\n", rec.PermissionProfile)
	}

	return ExitCode(rec.Status)
}

// readFileOrEmpty reads a file and returns its content, or "" on error.
func readFileOrEmpty(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimRight(string(data), "\n") + "\n"
}
