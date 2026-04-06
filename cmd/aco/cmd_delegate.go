package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/delegate"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
)

const (
	defaultAgentsDir = ".claude/agents"
	defaultFormatter = ".aco/formatter.yaml"
)

func cmdDelegate(d *deps, args []string) int {
	if d.stdout == nil {
		d.stdout = os.Stdout
	}
	if d.stderr == nil {
		d.stderr = os.Stderr
	}
	var (
		inputFlag       string
		agentsDir       = defaultAgentsDir
		formatterPath   = defaultFormatter
		noFormatter     bool
		noMeta          bool
		timeoutFlag     int
		positional      []string
	)

	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--input" || a == "-input":
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "--") {
				inputFlag = args[i+1]
				i++
			} else {
				fmt.Fprintf(d.stderr, "flag %q requires a value\n", a)
				return 1
			}
		case a == "--agents-dir":
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "--") {
				agentsDir = args[i+1]
				i++
			} else {
				fmt.Fprintf(d.stderr, "flag %q requires a value\n", a)
				return 1
			}
		case a == "--formatter":
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "--") {
				formatterPath = args[i+1]
				i++
			} else {
				fmt.Fprintf(d.stderr, "flag %q requires a value\n", a)
				return 1
			}
		case a == "--timeout":
			if i+1 < len(args) && !strings.HasPrefix(args[i+1], "--") {
				v, err := strconv.Atoi(args[i+1])
				if err != nil {
					fmt.Fprintf(d.stderr, "flag --timeout: invalid value %q\n", args[i+1])
					return 1
				}
				timeoutFlag = v
				i++
			} else {
				fmt.Fprintf(d.stderr, "flag %q requires a value\n", a)
				return 1
			}
		case a == "--no-formatter":
			noFormatter = true
		case a == "--no-meta":
			noMeta = true
		case len(a) > 0 && a[0] != '-':
			positional = append(positional, a)
		}
	}

	if len(positional) < 1 {
		fmt.Fprintln(d.stderr, "Usage: aco delegate <agent-id> [--input <text>] [--agents-dir <dir>] [--formatter <path>] [--timeout <secs>] [--no-formatter] [--no-meta]")
		return 1
	}

	spec, err := delegate.LoadAgentSpec(agentsDir, positional[0])
	if err != nil {
		fmt.Fprintln(d.stderr, err)
		return 1
	}
	if spec.ExecutionMode == "background" {
		fmt.Fprintf(d.stderr, "executionMode %q is not supported\n", spec.ExecutionMode)
		return 1
	}

	content := inputFlag
	if content == "" && d.stdin != nil && stdinHasData(d.stdin) {
		data, err := io.ReadAll(d.stdin)
		if err != nil {
			fmt.Fprintf(d.stderr, "aco: read stdin: %v\n", err)
			return 1
		}
		content = string(data)
	}

	formatter := delegate.DefaultFormatter()
	if !noFormatter {
		formatter, err = delegate.LoadFormatter(formatterPath)
		if err != nil {
			fmt.Fprintln(d.stderr, err)
			return 1
		}
	}

	resolution, err := delegate.Resolve(spec, formatter)
	if err != nil {
		fmt.Fprintln(d.stderr, err)
		return 1
	}

	prov, err := d.registry.Get(resolution.Provider)
	if err != nil {
		fmt.Fprintln(d.stderr, err)
		return 1
	}
	if !prov.IsAvailable() {
		fmt.Fprintf(d.stderr, "provider not found: %s\n", resolution.Provider)
		return 1
	}

	promptText, err := delegate.BuildPrompt(spec, content)
	if err != nil {
		fmt.Fprintln(d.stderr, err)
		return 1
	}

	profile := provider.PermissionProfile(spec.PermissionProfile)
	switch profile {
	case "", provider.ProfileDefault:
		profile = provider.ProfileDefault
	case provider.ProfileRestricted, provider.ProfileUnrestricted:
	default:
		fmt.Fprintf(d.stderr, "invalid permissionProfile %q\n", spec.PermissionProfile)
		return 1
	}

	timeoutSecs := timeoutFlag
	if timeoutSecs <= 0 {
		timeoutSecs = defaultTimeoutSecs
	}

	stdout := &sentinelWriter{w: d.stdout}
	result, runErr := d.runner.Run(context.Background(), runner.RunOpts{
		Provider:        prov,
		Prompt:          promptText,
		Model:           resolution.Model,
		LaunchArgs:      resolution.LaunchArgs,
		ReasoningEffort: resolution.ReasoningEffort,
		TimeoutSecs:     timeoutSecs,
		PermProfile:     profile,
		Stdout:          stdout,
	})

	if !noMeta && result.ProviderExited {
		if stdout.needsNewline() {
			_, _ = io.WriteString(d.stdout, "\n")
		}
		if err := writeSentinel(d.stdout, positional[0], resolution.Provider, resolution.Model, result.ExitCode, result.Duration.Milliseconds()); err != nil {
			fmt.Fprintf(d.stderr, "write sentinel: %v\n", err)
			return 1
		}
	}

	if runErr != nil {
		fmt.Fprintln(d.stderr, runErr)
		return classifyDelegateError(runErr)
	}
	return 0
}

type sentinelWriter struct {
	w        io.Writer
	lastByte byte
	wrote    bool
}

func (w *sentinelWriter) Write(p []byte) (int, error) {
	if len(p) > 0 {
		w.lastByte = p[len(p)-1]
		w.wrote = true
	}
	return w.w.Write(p)
}

func (w *sentinelWriter) needsNewline() bool {
	return w.wrote && w.lastByte != '\n'
}

func writeSentinel(w io.Writer, agentID, providerName, model string, exitCode int, durationMs int64) error {
	meta := struct {
		Agent      string `json:"agent"`
		Provider   string `json:"provider"`
		Model      string `json:"model"`
		ExitCode   int    `json:"exit_code"`
		DurationMS int64  `json:"duration_ms"`
	}{
		Agent:      agentID,
		Provider:   providerName,
		Model:      model,
		ExitCode:   exitCode,
		DurationMS: durationMs,
	}

	encoded, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "ACO_META: %s\n", encoded)
	return err
}

func classifyDelegateError(err error) int {
	var exitErr *provider.ExitError
	if errors.As(err, &exitErr) {
		return 1
	}
	var authErr *provider.AuthError
	if errors.As(err, &authErr) {
		return 1
	}
	var timeoutErr *provider.TimeoutError
	if errors.As(err, &timeoutErr) {
		return 1
	}
	var signalErr *provider.SignalError
	if errors.As(err, &signalErr) {
		return 1
	}
	return 1
}

func stdinHasData(r io.Reader) bool {
	f, ok := r.(*os.File)
	if !ok {
		return true
	}
	return !isTerminal(f)
}
