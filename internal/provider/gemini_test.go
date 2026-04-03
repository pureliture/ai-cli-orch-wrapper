package provider_test

import (
	"strings"
	"testing"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
)

func TestGeminiProvider_Name(t *testing.T) {
	p := provider.NewGemini()
	if p.Name() != "gemini" {
		t.Errorf("Name() = %q, want %q", p.Name(), "gemini")
	}
}

func TestGeminiProvider_Binary(t *testing.T) {
	p := provider.NewGemini()
	if p.Binary() != "gemini" {
		t.Errorf("Binary() = %q, want %q", p.Binary(), "gemini")
	}
}

func TestGeminiProvider_IsAvailable_Stub(t *testing.T) {
	// IsAvailable() does a real PATH lookup. We only assert it returns a bool
	// without panicking — the actual binary may or may not be present in CI.
	p := provider.NewGemini()
	_ = p.IsAvailable() // must not panic
}

func TestGeminiProvider_InstallHint(t *testing.T) {
	p := provider.NewGemini()
	hint := p.InstallHint()
	if !strings.Contains(hint, "gemini-cli") {
		t.Errorf("InstallHint() = %q, expected it to contain %q", hint, "gemini-cli")
	}
}

func TestGeminiProvider_BuildArgs_DefaultProfile(t *testing.T) {
	p := provider.NewGemini()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileDefault}
	args := p.BuildArgs("explain", "explain this", "some content", opts)

	// Must include -p flag with combined prompt+content.
	if len(args) < 2 {
		t.Fatalf("BuildArgs() returned too few args: %v", args)
	}
	if args[0] != "-p" {
		t.Errorf("args[0] = %q, want %q", args[0], "-p")
	}
	if !strings.Contains(args[1], "explain this") {
		t.Errorf("args[1] = %q, expected it to contain the prompt", args[1])
	}
	if !strings.Contains(args[1], "some content") {
		t.Errorf("args[1] = %q, expected it to contain the content", args[1])
	}

	// Default profile: --yolo must be present.
	hasYolo := false
	for _, a := range args {
		if a == "--yolo" {
			hasYolo = true
		}
	}
	if !hasYolo {
		t.Errorf("BuildArgs() with default profile: expected --yolo flag, got %v", args)
	}
}

func TestGeminiProvider_BuildArgs_UnrestrictedProfile(t *testing.T) {
	p := provider.NewGemini()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileUnrestricted}
	args := p.BuildArgs("explain", "explain this", "", opts)

	hasYolo := false
	for _, a := range args {
		if a == "--yolo" {
			hasYolo = true
		}
	}
	if !hasYolo {
		t.Errorf("BuildArgs() with unrestricted profile: expected --yolo flag, got %v", args)
	}
}

func TestGeminiProvider_BuildArgs_RestrictedProfile(t *testing.T) {
	p := provider.NewGemini()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileRestricted}
	args := p.BuildArgs("explain", "explain this", "", opts)

	for _, a := range args {
		if a == "--yolo" {
			t.Errorf("BuildArgs() with restricted profile: --yolo must NOT be present, got %v", args)
		}
	}
}

func TestGeminiProvider_BuildArgs_EmptyContent(t *testing.T) {
	p := provider.NewGemini()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileDefault}
	args := p.BuildArgs("explain", "just the prompt", "", opts)

	if args[1] != "just the prompt" {
		t.Errorf("args[1] = %q, want %q (no trailing newline when content is empty)", args[1], "just the prompt")
	}
}

func TestGeminiProvider_IsAuthFailure(t *testing.T) {
	p := provider.NewGemini()

	cases := []struct {
		name     string
		exitCode int
		stderr   string
		want     bool
	}{
		{"exit 126 empty stderr", 126, "", true},
		{"exit 126 random stderr", 126, "something", true},
		{"stderr unauthenticated lowercase", 1, "unauthenticated user", true},
		{"stderr Unauthenticated mixed case", 1, "Error: Unauthenticated", true},
		{"stderr please run", 0, "please run gemini login first", true},
		{"stderr PLEASE RUN uppercase", 0, "PLEASE RUN gemini", true},
		{"exit 1 unauthenticated combined", 1, "unauthenticated", true},
		{"exit 2 unrelated stderr", 2, "some other error", false},
		{"exit 0 clean", 0, "", false},
		{"exit 1 unrelated stderr", 1, "file not found", false},
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

func TestGeminiProvider_AuthHint(t *testing.T) {
	p := provider.NewGemini()
	hint := p.AuthHint()
	if !strings.Contains(hint, "gemini") {
		t.Errorf("AuthHint() = %q, expected it to mention gemini", hint)
	}
}
