// Command aco is the Go wrapper runtime for the ai-cli-orch-wrapper delegation product.
//
// It provides four subcommands:
//
//	aco run <provider> <command>   — delegate to provider CLI
//	aco status [--session <id>]    — show session lifecycle state
//	aco result [--session <id>]    — retrieve session output
//	aco cancel [--session <id>]    — cancel a running session
//
// Architecture contract: docs/contract/runtime-contract.md
// Session schema:        docs/contract/session-schema.md
// ccg parity checklist:  docs/contract/ccg-parity-checklist.md
package main

import (
	"fmt"
	"os"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/session"
)

const version = "0.0.1-phase1"

// deps bundles the runtime dependencies injected into commands.
// Phase 1: runner is stubbed; providers are empty.
// Phase 4: providers registered; Phase 2: real runner wired in.
type deps struct {
	store    *session.Store
	registry *provider.Registry
	runner   runner.Runner
}

func main() {
	if len(os.Args) < 2 {
		usage(os.Stderr)
		os.Exit(1)
	}

	d := &deps{
		store:    session.NewStore(),
		registry: provider.NewRegistry(),
		runner:   runner.StubRunner{},
	}

	// Phase 4: register providers.
	d.registry.Register(provider.NewGemini())
	d.registry.Register(provider.NewCopilot())

	switch os.Args[1] {
	case "--version", "-v":
		fmt.Printf("aco %s\n", version)
	case "run":
		os.Exit(cmdRun(d, os.Args[2:]))
	case "status":
		os.Exit(cmdStatus(d, os.Args[2:]))
	case "result":
		os.Exit(cmdResult(d, os.Args[2:]))
	case "cancel":
		os.Exit(cmdCancel(d, os.Args[2:]))
	default:
		fmt.Fprintf(os.Stderr, "aco: unknown command %q\n", os.Args[1])
		usage(os.Stderr)
		os.Exit(1)
	}
}

func usage(w *os.File) {
	fmt.Fprintln(w, "Usage: aco <run|status|result|cancel> [options]")
	fmt.Fprintln(w, "       aco --version")
}
