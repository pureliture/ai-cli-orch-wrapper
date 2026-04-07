package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
)

type delegateTestRunner struct {
	run    func(context.Context, runner.RunOpts) (runner.RunResult, error)
	last   runner.RunOpts
	called bool
}

func (r *delegateTestRunner) Run(ctx context.Context, opts runner.RunOpts) (runner.RunResult, error) {
	r.called = true
	r.last = opts
	if r.run != nil {
		return r.run(ctx, opts)
	}
	return runner.RunResult{}, nil
}

func TestCmdDelegate_RoutesViaFormatterAndEmitsSentinel(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "researcher.md"), `---
id: researcher
when: Analyze code
modelAlias: sonnet-4.6
roleHint: research
permissionProfile: restricted
reasoningEffort: max
---
Research body
`)
	writeTestFile(t, filepath.Join(root, ".aco", "formatter.yaml"), `version: 1
providerDefaults:
  codex:
    launchArgs:
      - --sandbox
      - workspace-write
  gemini_cli:
    launchArgs:
      - --yolo
modelAliasMap:
  sonnet-4.6:
    provider: codex
    model: gpt-5.4
providerModels:
  codex:
    - gpt-5.4
  gemini_cli:
    - gemini-2.5-pro
effortMap:
  gemini_cli:
    max: high
roleHintRules:
  research:
    preferredProvider: gemini_cli
fallback:
  provider: codex
  model: gpt-5.4
`)

	registry := provider.NewRegistry()
	registry.Register(newStaticProvider("codex", "codex"))
	registry.Register(newStaticProvider("gemini_cli", "gemini"))

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	testRunner := &delegateTestRunner{
		run: func(_ context.Context, opts runner.RunOpts) (runner.RunResult, error) {
			if _, err := opts.Stdout.Write([]byte("provider output line\n")); err != nil {
				t.Fatalf("write provider output: %v", err)
			}
			return runner.RunResult{ExitCode: 0, Duration: 3812 * time.Millisecond, ProviderExited: true}, nil
		},
	}

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdDelegate(d, []string{
		"researcher",
		"--input", "analyze this codebase",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	if !testRunner.called {
		t.Fatal("expected runner to be called")
	}
	if testRunner.last.Provider.Name() != "gemini_cli" {
		t.Fatalf("runner provider = %q, want gemini_cli", testRunner.last.Provider.Name())
	}
	if testRunner.last.Model != "gemini-2.5-pro" {
		t.Fatalf("runner model = %q, want gemini-2.5-pro", testRunner.last.Model)
	}
	if testRunner.last.PermProfile != provider.ProfileRestricted {
		t.Fatalf("permission profile = %q, want restricted", testRunner.last.PermProfile)
	}
	if testRunner.last.ReasoningEffort != "high" {
		t.Fatalf("reasoning effort = %q, want high", testRunner.last.ReasoningEffort)
	}
	if got := stdout.String(); !strings.Contains(got, "provider output line\nACO_META: {\"agent\":\"researcher\",\"provider\":\"gemini_cli\",\"model\":\"gemini-2.5-pro\",\"exit_code\":0,\"duration_ms\":3812}\n") {
		t.Fatalf("stdout missing expected output+sentinel: %q", got)
	}
}

func TestCmdDelegate_NoFormatterFallsBackToCodex(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "reviewer.md"), `---
id: reviewer
when: Review changes
---
Review body
`)

	registry := provider.NewRegistry()
	registry.Register(newStaticProvider("codex", "codex"))

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	testRunner := &delegateTestRunner{}

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdDelegate(d, []string{
		"reviewer",
		"--input", "check this change",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "missing.yaml"),
		"--no-formatter",
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	if !testRunner.called {
		t.Fatal("expected runner to be called")
	}
	if testRunner.last.Provider.Name() != "codex" {
		t.Fatalf("runner provider = %q, want codex", testRunner.last.Provider.Name())
	}
	if testRunner.last.Model != "gpt-5.4" {
		t.Fatalf("runner model = %q, want gpt-5.4", testRunner.last.Model)
	}
}

func TestCmdDelegate_RejectsBackgroundExecutionMode(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "executor.md"), `---
id: executor
when: Apply changes
executionMode: background
---
Execute body
`)
	writeTestFile(t, filepath.Join(root, ".aco", "formatter.yaml"), `version: 1
fallback:
  provider: codex
  model: gpt-5.4
`)

	registry := provider.NewRegistry()
	registry.Register(newStaticProvider("codex", "codex"))

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	testRunner := &delegateTestRunner{}

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdDelegate(d, []string{
		"executor",
		"--input", "apply this fix",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 1 {
		t.Fatalf("cmdDelegate exitCode = %d, want 1", exitCode)
	}
	if testRunner.called {
		t.Fatal("runner should not be called for unsupported executionMode")
	}
	if got := stderr.String(); !strings.Contains(got, "executionMode \"background\" is not supported") {
		t.Fatalf("stderr = %q, want unsupported executionMode error", got)
	}
}

func TestCmdDelegate_PrintsSentinelForNonZeroProviderExit(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "reviewer.md"), `---
id: reviewer
when: Review code
modelAlias: sonnet-4.6
---
Review body
`)
	writeTestFile(t, filepath.Join(root, ".aco", "formatter.yaml"), `version: 1
modelAliasMap:
  sonnet-4.6:
    provider: codex
    model: gpt-5.4
fallback:
  provider: codex
  model: gpt-5.4
`)

	registry := provider.NewRegistry()
	registry.Register(newStaticProvider("codex", "codex"))

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	testRunner := &delegateTestRunner{
		run: func(_ context.Context, opts runner.RunOpts) (runner.RunResult, error) {
			_, _ = opts.Stdout.Write([]byte("partial output\n"))
			return runner.RunResult{ExitCode: 17, Duration: 25 * time.Millisecond, ProviderExited: true}, &provider.ExitError{
				Provider: "codex",
				ExitCode: 17,
				Stderr:   "boom",
			}
		},
	}

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdDelegate(d, []string{
		"reviewer",
		"--input", "review",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 1 {
		t.Fatalf("cmdDelegate exitCode = %d, want 1", exitCode)
	}
	if got := stdout.String(); !strings.Contains(got, "ACO_META: {\"agent\":\"reviewer\",\"provider\":\"codex\",\"model\":\"gpt-5.4\",\"exit_code\":17,\"duration_ms\":25}\n") {
		t.Fatalf("stdout missing sentinel for non-zero exit: %q", got)
	}
	if got := stderr.String(); !strings.Contains(got, "provider \"codex\": exited with code 17") {
		t.Fatalf("stderr missing provider exit error: %q", got)
	}
}

type staticTestProvider struct {
	name   string
	binary string
}

func newStaticProvider(name, binary string) provider.Provider {
	return &staticTestProvider{name: name, binary: binary}
}

func (p *staticTestProvider) Name() string      { return p.name }
func (p *staticTestProvider) Binary() string    { return p.binary }
func (p *staticTestProvider) IsAvailable() bool { return true }
func (p *staticTestProvider) InstallHint() string {
	return "install " + p.name
}
func (p *staticTestProvider) BuildArgs(_, _, _ string, _ provider.InvokeOpts) []string { return nil }
func (p *staticTestProvider) IsAuthFailure(int, string) bool                           { return false }
func (p *staticTestProvider) AuthHint() string                                         { return "" }
func (p *staticTestProvider) CheckAuth(context.Context) error                          { return nil }

func writeTestFile(t *testing.T, path string, contents string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
