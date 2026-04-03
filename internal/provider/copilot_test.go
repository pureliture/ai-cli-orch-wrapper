package provider_test

import (
	"strings"
	"testing"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
)

func TestCopilotProvider_Name(t *testing.T) {
	p := provider.NewCopilot()
	if p.Name() != "copilot" {
		t.Errorf("Name() = %q, want %q", p.Name(), "copilot")
	}
}

func TestCopilotProvider_Binary(t *testing.T) {
	p := provider.NewCopilot()
	if p.Binary() != "copilot" {
		t.Errorf("Binary() = %q, want %q", p.Binary(), "copilot")
	}
}

func TestCopilotProvider_IsAvailable_Stub(t *testing.T) {
	// IsAvailable() does a real PATH lookup. We only assert it returns a bool
	// without panicking — the actual binary may or may not be present in CI.
	p := provider.NewCopilot()
	_ = p.IsAvailable() // must not panic
}

func TestCopilotProvider_InstallHint(t *testing.T) {
	p := provider.NewCopilot()
	hint := p.InstallHint()
	if !strings.Contains(hint, "copilot") {
		t.Errorf("InstallHint() = %q, expected it to contain %q", hint, "copilot")
	}
}

func TestCopilotProvider_BuildArgs_WithContent(t *testing.T) {
	p := provider.NewCopilot()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileDefault}
	args := p.BuildArgs("suggest", "list running pods", "kubectl context: minikube", opts)

	if len(args) < 3 {
		t.Fatalf("BuildArgs() returned too few args: %v", args)
	}
	if args[0] != "suggest" {
		t.Errorf("args[0] = %q, want %q", args[0], "suggest")
	}
	if args[1] != "-s" {
		t.Errorf("args[1] = %q, want %q", args[1], "-s")
	}
	combined := args[2]
	if !strings.Contains(combined, "list running pods") {
		t.Errorf("args[2] = %q, expected it to contain the prompt", combined)
	}
	if !strings.Contains(combined, "kubectl context: minikube") {
		t.Errorf("args[2] = %q, expected it to contain the content", combined)
	}
}

func TestCopilotProvider_BuildArgs_NoContent(t *testing.T) {
	p := provider.NewCopilot()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileDefault}
	args := p.BuildArgs("suggest", "only a prompt", "", opts)

	if args[2] != "only a prompt" {
		t.Errorf("args[2] = %q, want %q (no trailing newline when content is empty)", args[2], "only a prompt")
	}
}

func TestCopilotProvider_IsAuthFailure(t *testing.T) {
	p := provider.NewCopilot()

	cases := []struct {
		name     string
		exitCode int
		stderr   string
		want     bool
	}{
		{"exit 126 empty stderr", 126, "", true},
		{"exit 126 random stderr", 126, "some message", true},
		{"stderr unauthorized lowercase", 1, "unauthorized request", true},
		{"stderr Unauthorized mixed case", 1, "Error: Unauthorized", true},
		{"stderr authentication", 1, "authentication failed", true},
		{"stderr AUTHENTICATION uppercase", 1, "AUTHENTICATION REQUIRED", true},
		{"stderr login", 1, "please login first", true},
		{"stderr LOGIN uppercase", 1, "LOGIN required", true},
		{"stderr token", 1, "invalid token", true},
		{"stderr TOKEN uppercase", 1, "TOKEN expired", true},
		{"stderr credential", 1, "bad credential", true},
		{"stderr CREDENTIAL uppercase", 1, "CREDENTIAL mismatch", true},
		{"exit 1 unrelated stderr", 1, "command not found", false},
		{"exit 0 clean", 0, "", false},
		{"exit 2 unrelated stderr", 2, "timeout reached", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := p.IsAuthFailure(tc.exitCode, tc.stderr)
			if got != tc.want {
				t.Errorf("IsAuthFailure(%d, %q) = %v, want %v", tc.exitCode, tc.stderr, got, tc.want)
			}
		})
	}
}

func TestCopilotProvider_AuthHint(t *testing.T) {
	p := provider.NewCopilot()
	hint := p.AuthHint()
	if !strings.Contains(hint, "copilot") && !strings.Contains(hint, "gh") {
		t.Errorf("AuthHint() = %q, expected it to mention copilot or gh", hint)
	}
}
