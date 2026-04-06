package main

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
)

type runTestRunner struct {
	last   runner.RunOpts
	called bool
}

func (r *runTestRunner) Run(_ context.Context, opts runner.RunOpts) (runner.RunResult, error) {
	r.called = true
	r.last = opts
	return runner.RunResult{ExitCode: 0, ProviderExited: true}, nil
}

func TestCmdRun_PrependsFocusToContent(t *testing.T) {
	registry := provider.NewRegistry()
	registry.Register(newStaticProvider("gemini", "gemini"))

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	testRunner := &runTestRunner{}

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stdout:   &stdout,
		stderr:   &stderr,
	}

	exitCode := cmdRun(d, []string{
		"gemini",
		"adversarial",
		"--focus", "security",
		"--input", "inspect the patch",
	})

	if exitCode != 0 {
		t.Fatalf("cmdRun exitCode = %d, want 0; stderr=%s", exitCode, stderr.String())
	}
	if !testRunner.called {
		t.Fatal("expected runner to be called")
	}
	if got := testRunner.last.Content; !strings.Contains(got, "Focus area: security") || !strings.Contains(got, "inspect the patch") {
		t.Fatalf("content = %q, want focus header and input", got)
	}
}

func TestCmdRun_RejectsInvalidTimeout(t *testing.T) {
	registry := provider.NewRegistry()
	registry.Register(newStaticProvider("gemini", "gemini"))

	var stderr bytes.Buffer
	testRunner := &runTestRunner{}

	d := &deps{
		registry: registry,
		runner:   testRunner,
		stderr:   &stderr,
	}

	exitCode := cmdRun(d, []string{
		"gemini",
		"review",
		"--timeout", "abc",
	})

	if exitCode != 1 {
		t.Fatalf("cmdRun exitCode = %d, want 1", exitCode)
	}
	if testRunner.called {
		t.Fatal("runner should not be called for invalid timeout")
	}
	if got := stderr.String(); !strings.Contains(got, `flag --timeout: invalid value "abc"`) {
		t.Fatalf("stderr = %q, want invalid timeout error", got)
	}
}
