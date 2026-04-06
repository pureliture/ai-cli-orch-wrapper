// Package main — aco run subcommand.
// Reference: ccg-workflow/codeagent-wrapper/executor.go (blocking execution model)
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
)

const defaultTimeoutSecs = 300

// cmdRun implements `aco run <provider> <command>`.
//
// Blocking: spawns the provider CLI, streams stdout to the caller,
// exits when the provider exits. Cancel by sending SIGTERM to this process —
// it is forwarded to the provider child automatically.
func cmdRun(d *deps, args []string) int {
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

	profile := provider.PermissionProfile(profileFlag)
	switch profile {
	case provider.ProfileDefault, provider.ProfileRestricted, provider.ProfileUnrestricted:
	default:
		fmt.Fprintf(os.Stderr, "invalid --permission-profile %q: must be default|restricted|unrestricted\n", profileFlag)
		return 1
	}

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

	prov, err := d.registry.Get(providerKey)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if !prov.IsAvailable() {
		fmt.Fprintf(os.Stderr, "provider %q not found in PATH\n  Install: %s\n", providerKey, prov.InstallHint())
		return 1
	}

	content := inputFlag
	if content == "" && !isTerminal(os.Stdin) {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			fmt.Fprintf(os.Stderr, "aco: read stdin: %v\n", err)
			return 1
		}
		content = string(data)
	}

	cwd, _ := os.Getwd()
	promptText, err := prompt.Load(cwd, providerKey, command)
	if err != nil {
		fmt.Fprintf(os.Stderr, "aco: load prompt: %v\n", err)
		return 1
	}

	_, runErr := d.runner.Run(context.Background(), runner.RunOpts{
		Provider:    prov,
		Command:     command,
		Prompt:      promptText,
		Content:     content,
		TimeoutSecs: timeoutSecs,
		PermProfile: profile,
		Stdout:      os.Stdout,
	})

	if runErr != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", runErr)
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
