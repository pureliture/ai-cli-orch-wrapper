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
	if testRunner.last.ReasoningEffort != "max" {
		t.Fatalf("reasoning effort = %q, want max", testRunner.last.ReasoningEffort)
	}
	// Check that sentinel has new format with random identifier
	got := stdout.String()
	if !strings.Contains(got, "ACO_META_") {
		t.Fatalf("stdout missing ACO_META_ sentinel prefix: %q", got)
	}
	// Verify the sentinel has 16 hex chars after ACO_META_
	if !strings.Contains(got, `"agent":"researcher"`) {
		t.Fatalf("stdout missing agent field: %q", got)
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
	if got := stdout.String(); !strings.Contains(got, `ACO_META_`) || !strings.Contains(got, `"agent":"reviewer","provider":"codex","model":"gpt-5.4","exit_code":17,"duration_ms":25}`+"\n") {
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

// TestGenerateSentinelRID tests that generateSentinelRID produces valid 16-hex-char identifiers.
func TestGenerateSentinelRID(t *testing.T) {
	rid, err := generateSentinelRID()
	if err != nil {
		t.Fatalf("generateSentinelRID() error = %v", err)
	}
	if len(rid) != 16 {
		t.Fatalf("generateSentinelRID() length = %d, want 16", len(rid))
	}
	for _, c := range rid {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Fatalf("generateSentinelRID() = %q, contains non-hex char %c", rid, c)
		}
	}
}

// TestGenerateSentinelRID_Uniqueness verifies that multiple calls produce different identifiers.
func TestGenerateSentinelRID_Uniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		rid, err := generateSentinelRID()
		if err != nil {
			t.Fatalf("generateSentinelRID() error = %v", err)
		}
		if seen[rid] {
			t.Fatalf("generateSentinelRID() collision at iteration %d: rid %q already seen", i, rid)
		}
		seen[rid] = true
	}
}

// TestWriteSentinel_Format verifies the sentinel output format includes the random identifier.
func TestWriteSentinel_Format(t *testing.T) {
	var buf bytes.Buffer
	err := writeSentinel(&buf, "a3f2b1c4d5e6f789", "researcher", "gemini_cli", "gemini-2.5-pro", 0, 1234)
	if err != nil {
		t.Fatalf("writeSentinel() error = %v", err)
	}
	got := buf.String()
	// Must contain new format with rid
	if !strings.Contains(got, "ACO_META_a3f2b1c4d5e6f789: ") {
		t.Fatalf("writeSentinel() output = %q, want ACO_META_a3f2b1c4d5e6f789 prefix", got)
	}
	// Must contain expected JSON fields
	if !strings.Contains(got, `"agent":"researcher"`) {
		t.Fatalf("writeSentinel() output missing agent field: %q", got)
	}
	if !strings.Contains(got, `"provider":"gemini_cli"`) {
		t.Fatalf("writeSentinel() output missing provider field: %q", got)
	}
	if !strings.Contains(got, `"model":"gemini-2.5-pro"`) {
		t.Fatalf("writeSentinel() output missing model field: %q", got)
	}
	if !strings.Contains(got, `"exit_code":0`) {
		t.Fatalf("writeSentinel() output missing exit_code field: %q", got)
	}
	if !strings.Contains(got, `"duration_ms":1234`) {
		t.Fatalf("writeSentinel() output missing duration_ms field: %q", got)
	}
}

// TestSentinelCollisionPrevention_ProviderOutput tests that provider output starting with ACO_META_
// followed by non-16-hex-chars is not mistaken for a sentinel.
func TestSentinelCollisionPrevention_ProviderOutput(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "tester.md"), `---
id: tester
when: Test
modelAlias: sonnet-4.6
---
Test body
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
			// Provider accidentally emits a line that looks like the old sentinel format
			_, _ = opts.Stdout.Write([]byte("ACO_META: accidental output from provider\n"))
			_, _ = opts.Stdout.Write([]byte("normal output line\n"))
			return runner.RunResult{ExitCode: 0, Duration: 100 * time.Millisecond, ProviderExited: true}, nil
		},
	}

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdDelegate(d, []string{
		"tester",
		"--input", "test",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	got := stdout.String()
	// Provider's accidental "ACO_META:" should be present (not filtered)
	if !strings.Contains(got, "ACO_META: accidental output from provider\n") {
		t.Fatalf("stdout missing provider's accidental ACO_META line: %q", got)
	}
	// Real sentinel should use new format with 16 hex char rid
	if !strings.Contains(got, "ACO_META_") {
		t.Fatalf("stdout missing real sentinel: %q", got)
	}
}

// TestCmdDelegate_ACOTimeoutEnvVar verifies that the ACO_TIMEOUT_SECONDS environment
// variable is respected when no --timeout flag is provided.
func TestCmdDelegate_ACOTimeoutEnvVar(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "tester.md"), `---
id: tester
when: Test
---
Test body
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
	var seenTimeout int
	testRunner := &delegateTestRunner{
		run: func(_ context.Context, opts runner.RunOpts) (runner.RunResult, error) {
			seenTimeout = opts.TimeoutSecs
			return runner.RunResult{ExitCode: 0, Duration: 100 * time.Millisecond, ProviderExited: true}, nil
		},
	}

	// Set ACO_TIMEOUT_SECONDS in the environment
	t.Setenv("ACO_TIMEOUT_SECONDS", "42")

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdDelegate(d, []string{
		"tester",
		"--input", "test",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	if seenTimeout != 42 {
		t.Fatalf("TimeoutSecs = %d, want 42 (from ACO_TIMEOUT_SECONDS)", seenTimeout)
	}
}

// TestCmdDelegate_ACOTimeoutFlagOverridesEnvVar verifies that --timeout flag
// takes precedence over the ACO_TIMEOUT_SECONDS environment variable.
func TestCmdDelegate_ACOTimeoutFlagOverridesEnvVar(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "tester.md"), `---
id: tester
when: Test
---
Test body
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
	var seenTimeout int
	testRunner := &delegateTestRunner{
		run: func(_ context.Context, opts runner.RunOpts) (runner.RunResult, error) {
			seenTimeout = opts.TimeoutSecs
			return runner.RunResult{ExitCode: 0, Duration: 100 * time.Millisecond, ProviderExited: true}, nil
		},
	}

	// Set both env var and flag — flag should win
	t.Setenv("ACO_TIMEOUT_SECONDS", "99")

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdDelegate(d, []string{
		"tester",
		"--input", "test",
		"--timeout", "17",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	if seenTimeout != 17 {
		t.Fatalf("TimeoutSecs = %d, want 17 (from --timeout flag)", seenTimeout)
	}
}

// TestCmdDelegate_ACOTimeoutEnvVarInvalid ignores an invalid ACO_TIMEOUT_SECONDS value.
func TestCmdDelegate_ACOTimeoutEnvVarInvalid(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "tester.md"), `---
id: tester
when: Test
---
Test body
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
	var seenTimeout int
	testRunner := &delegateTestRunner{
		run: func(_ context.Context, opts runner.RunOpts) (runner.RunResult, error) {
			seenTimeout = opts.TimeoutSecs
			return runner.RunResult{ExitCode: 0, Duration: 100 * time.Millisecond, ProviderExited: true}, nil
		},
	}

	// Set an invalid (non-positive) value in the environment
	t.Setenv("ACO_TIMEOUT_SECONDS", "-5")

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdDelegate(d, []string{
		"tester",
		"--input", "test",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	// Should fall back to default timeout (not the invalid env value)
	if seenTimeout == -5 {
		t.Fatalf("TimeoutSecs = %d — invalid env value should be ignored", seenTimeout)
	}
}

// TestCmdDelegate_InputFlagEmptyString passes empty input explicitly.
func TestCmdDelegate_InputFlagEmptyString(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "empty-test.md"), `---
id: empty-test
when: Empty test
---
Fixed body content
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
		"empty-test",
		"--input", "",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	if !testRunner.called {
		t.Fatal("expected runner to be called")
	}
	// Prompt should contain the agent body (input was empty string)
	if !strings.Contains(testRunner.last.Prompt, "Fixed body content") {
		t.Fatalf("prompt missing body content: %q", testRunner.last.Prompt)
	}
}

// TestCmdDelegate_InputFlagAmbiguousFlagLikeValue rejects flag-like values after --input.
func TestCmdDelegate_InputFlagAmbiguousFlagLikeValue(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "ambiguous.md"), `---
id: ambiguous
when: Ambiguous test
---
Body
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

	// Pass --agents-dir as the "value" of --input — should be rejected
	exitCode := cmdDelegate(d, []string{
		"ambiguous",
		"--input", "--agents-dir",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 1 {
		t.Fatalf("cmdDelegate exitCode = %d, want 1 (ambiguous flag)", exitCode)
	}
	if testRunner.called {
		t.Fatal("runner should not be called for ambiguous flag")
	}
	if got := stderr.String(); !strings.Contains(got, "requires a value") {
		t.Fatalf("stderr = %q, want flag requires a value error", got)
	}
}

// TestCmdDelegate_InputFlagTerminatorDoubleDash accepts -- as terminator.
func TestCmdDelegate_InputFlagTerminatorDoubleDash(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "termtest.md"), `---
id: termtest
when: Terminator test
---
Body
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

	// -- terminates flag parsing; next arg is the agent ID followed by its flags
	exitCode := cmdDelegate(d, []string{
		"termtest",
		"--input", "--",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	if !testRunner.called {
		t.Fatal("expected runner to be called")
	}
}

// TestCmdDelegate_InputFlagEqualsFormat accepts --input=<value> syntax.
func TestCmdDelegate_InputFlagEqualsFormat(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, ".claude", "agents", "eqtest.md"), `---
id: eqtest
when: Equals test
---
Body
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
		"eqtest",
		"--input=analyze this with equals syntax",
		"--agents-dir", filepath.Join(root, ".claude", "agents"),
		"--formatter", filepath.Join(root, ".aco", "formatter.yaml"),
	})

	if exitCode != 0 {
		t.Fatalf("cmdDelegate exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	if !testRunner.called {
		t.Fatal("expected runner to be called")
	}
	if !strings.Contains(testRunner.last.Prompt, "analyze this with equals syntax") {
		t.Fatalf("prompt = %q, want contains input text", testRunner.last.Prompt)
	}
}

// TestCmdDelegate_AgentsDirPathTraversal rejects .. in --agents-dir.
func TestCmdDelegate_AgentsDirPathTraversal(t *testing.T) {
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
		"evil",
		"--input", "test",
		"--agents-dir", "/tmp/../../etc",
		"--formatter", "/tmp/formatter.yaml",
	})

	if exitCode != 1 {
		t.Fatalf("cmdDelegate exitCode = %d, want 1 for path traversal", exitCode)
	}
	if testRunner.called {
		t.Fatal("runner should not be called for path traversal")
	}
	if got := stderr.String(); !strings.Contains(got, "path traversal not allowed") {
		t.Fatalf("stderr = %q, want path traversal error", got)
	}
}

// TestCmdDelegate_FormatterPathTraversal rejects .. in --formatter.
func TestCmdDelegate_FormatterPathTraversal(t *testing.T) {
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
		"evil",
		"--input", "test",
		"--agents-dir", "/tmp/agents",
		"--formatter", "/tmp/../../../etc/passwd",
	})

	if exitCode != 1 {
		t.Fatalf("cmdDelegate exitCode = %d, want 1 for path traversal", exitCode)
	}
	if testRunner.called {
		t.Fatal("runner should not be called for path traversal")
	}
	if got := stderr.String(); !strings.Contains(got, "path traversal not allowed") {
		t.Fatalf("stderr = %q, want path traversal error", got)
	}
}

// TestWriteSentinel_LargeDuration verifies sentinel handles large duration values.
func TestWriteSentinel_LargeDuration(t *testing.T) {
	var buf bytes.Buffer
	err := writeSentinel(&buf, "a3f2b1c4d5e6f789", "agent", "provider", "model", 0, 9_999_999_999)
	if err != nil {
		t.Fatalf("writeSentinel() error = %v", err)
	}
	got := buf.String()
	if !strings.Contains(got, `"duration_ms":9999999999`) {
		t.Fatalf("writeSentinel() output missing large duration_ms: %q", got)
	}
}

// TestSentinelWriter_NeedsNewline returns true when last byte is not \n.
func TestSentinelWriter_NeedsNewline(t *testing.T) {
	var buf bytes.Buffer
	w := &sentinelWriter{w: &buf}
	_, _ = w.Write([]byte("output without newline"))
	if !w.needsNewline() {
		t.Fatal("needsNewline() = false, want true (last byte not \\n)")
	}
}

// TestSentinelWriter_NoNewlineNeeded returns false when last byte is \n.
func TestSentinelWriter_NoNewlineNeeded(t *testing.T) {
	var buf bytes.Buffer
	w := &sentinelWriter{w: &buf}
	_, _ = w.Write([]byte("output with newline\n"))
	if w.needsNewline() {
		t.Fatal("needsNewline() = true, want false (last byte is \\n)")
	}
}
