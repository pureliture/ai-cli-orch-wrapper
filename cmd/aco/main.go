// Command aco is the Go wrapper runtime for the ai-cli-orch-wrapper delegation product.
//
// It provides one subcommand:
//
//	aco run <provider> <command>   — delegate to provider CLI (blocking)
//
// Architecture contract: docs/contract/blocking-execution-contract.md
//
// Removed in Phase A: aco status, aco result, aco cancel.
// These were codex-plugin-cc surface, not ccg-workflow. See session-plan.md.
package main

import (
	"fmt"
	"io"
	"os"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
)

const version = "0.0.3-phase-a"

// deps bundles the runtime dependencies injected into commands.
type deps struct {
	registry *provider.Registry
	runner   runner.Runner
	stdin    io.Reader
	stdout   io.Writer
	stderr   io.Writer
}

func main() {
	if len(os.Args) < 2 {
		usage(os.Stderr)
		os.Exit(1)
	}

	d := &deps{
		registry: provider.NewRegistry(),
		runner:   runner.ProcessRunner{},
		stdin:    os.Stdin,
		stdout:   os.Stdout,
		stderr:   os.Stderr,
	}

	d.registry.Register(provider.NewCodex())
	d.registry.Register(provider.NewGemini())
	d.registry.Register(provider.NewGeminiCLI())

	switch os.Args[1] {
	case "--version", "-v":
		fmt.Printf("aco %s\n", version)
	case "run":
		os.Exit(cmdRun(d, os.Args[2:]))
	case "delegate":
		os.Exit(cmdDelegate(d, os.Args[2:]))
	default:
		fmt.Fprintf(d.stderr, "aco: unknown command %q\n", os.Args[1])
		usage(os.Stderr)
		os.Exit(1)
	}
}

func usage(w *os.File) {
	fmt.Fprintln(w, "Usage: aco run <provider> <command> [options]")
	fmt.Fprintln(w, "       aco delegate <agent-id> [options]")
	fmt.Fprintln(w, "       aco --version")
}
