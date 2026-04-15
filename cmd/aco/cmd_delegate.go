package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
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
		case strings.HasPrefix(a, "--input="), strings.HasPrefix(a, "-input="):
			// --input=<value> or -input=<value> format
			eq := strings.Index(a, "=")
			inputFlag = a[eq+1:]
		case a == "--input" || a == "-input":
			if i+1 < len(args) {
				val := args[i+1]
				switch val {
				case "--":
					// Terminator: stop flag parsing, --input remains empty
					// Note: if user wants literal "--" as input, use --input="--"
					i++
				case "--input", "--input=value",
					"--agents-dir", "--formatter",
					"--no-formatter", "--no-meta",
					"--timeout":
					// Flag-like value after --input is ambiguous
					fmt.Fprintf(d.stderr, "flag %q requires a value\n", a)
					return 1
				default:
					if strings.HasPrefix(val, "--input=") {
						// --input=<value> format
						inputFlag = val[len("--input="):]
						i++
					} else if strings.HasPrefix(val, "--") {
						// Any other flag-like arg after --input is ambiguous
						fmt.Fprintf(d.stderr, "flag %q requires a value\n", a)
						return 1
					} else {
						inputFlag = val
						i++
					}
				}
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
		default:
			fmt.Fprintf(d.stderr, "unknown flag %q\n", a)
			fmt.Fprintln(d.stderr, "Usage: aco delegate <agent-id> [--input <text>] [--agents-dir <dir>] [--formatter <path>] [--timeout <secs>] [--no-formatter] [--no-meta]")
			return 1
		}
	}

	if len(positional) < 1 {
		fmt.Fprintln(d.stderr, "Usage: aco delegate <agent-id> [--input <text>] [--agents-dir <dir>] [--formatter <path>] [--timeout <secs>] [--no-formatter] [--no-meta]")
		return 1
	}

	// Validate paths to prevent traversal attacks
	if _, err := validatePath(agentsDir, ""); err != nil {
		fmt.Fprintf(d.stderr, "aco: invalid --agents-dir: %v\n", err)
		return 1
	}
	if _, err := validatePath(formatterPath, ""); err != nil {
		fmt.Fprintf(d.stderr, "aco: invalid --formatter: %v\n", err)
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
		fmt.Fprintf(d.stderr, "provider %q not found in PATH\n  Install: %s\n", resolution.Provider, prov.InstallHint())
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
		rid, err := generateSentinelRID()
		if err != nil {
			fmt.Fprintf(d.stderr, "aco: %v\n", err)
			return 1
		}
		if stdout.needsNewline() {
			_, _ = io.WriteString(d.stdout, "\n")
		}
		if err := writeSentinel(d.stdout, rid, positional[0], resolution.Provider, resolution.Model, result.ExitCode, result.Duration.Milliseconds()); err != nil {
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

// generateSentinelRID generates an 8-byte random identifier encoded as 16 hex chars.
// Returns an error if crypto/rand fails; callers must exit without sentinel on error.
func generateSentinelRID() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate sentinel identifier: %w", err)
	}
	return hex.EncodeToString(b), nil
}

func writeSentinel(w io.Writer, rid, agentID, providerName, model string, exitCode int, durationMs int64) error {
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
	_, err = fmt.Fprintf(w, "ACO_META_%s: %s\n", rid, encoded)
	return err
}

func classifyDelegateError(_ error) int {
	return 1
}

func stdinHasData(r io.Reader) bool {
	f, ok := r.(*os.File)
	if !ok {
		return true
	}
	return !isTerminal(f)
}

// validatePath checks that a file path does not contain path traversal (..).
// It cleans the path and verifies that the cleaned path does not escape its base.
// Returns the cleaned path if valid, or an error if the path contains traversal.
func validatePath(path, base string) (string, error) {
	// Check each path component for ".." to reject actual traversal attempts
	// while allowing legitimate names like "foo..bar"
	components := strings.FieldsFunc(path, func(r rune) bool {
		return r == '/' || r == '\\' || r == rune(filepath.Separator)
	})
	for _, component := range components {
		if component == ".." {
			return "", fmt.Errorf("invalid file path: path traversal not allowed")
		}
	}

	// Clean the path to resolve any . components
	cleaned := filepath.Clean(path)

	// If a base is provided, ensure the path doesn't escape it
	if base != "" {
		absPath, err := filepath.Abs(cleaned)
		if err != nil {
			return "", fmt.Errorf("invalid file path: %w", err)
		}
		absBase, err := filepath.Abs(base)
		if err != nil {
			return "", fmt.Errorf("invalid base path: %w", err)
		}
		// Ensure absBase ends with separator for strict prefix checking
		// to prevent attacks like base=/tmp/foobar and path=/tmp/foo
		if !strings.HasSuffix(absBase, string(filepath.Separator)) {
			absBase += string(filepath.Separator)
		}
		if !strings.HasPrefix(absPath, absBase) {
			return "", fmt.Errorf("invalid file path: escapes base directory")
		}
	}

	return cleaned, nil
}
