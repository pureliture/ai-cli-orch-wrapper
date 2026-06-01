package provider_test

import (
	"strings"
	"testing"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
)

func TestAntigravityProvider_Name(t *testing.T) {
	p := provider.NewAntigravity()
	if p.Name() != "antigravity" {
		t.Errorf("Name() = %q, want %q", p.Name(), "antigravity")
	}
}

func TestAntigravityProvider_Binary(t *testing.T) {
	p := provider.NewAntigravity()
	if p.Binary() != "agy" {
		t.Errorf("Binary() = %q, want %q", p.Binary(), "agy")
	}
}

func TestAntigravityProvider_IsAvailable_Stub(t *testing.T) {
	// IsAvailable()는 실제 PATH 조회를 수행한다. CI에 바이너리가 없어도 패닉 없이 bool을 반환해야 한다.
	p := provider.NewAntigravity()
	_ = p.IsAvailable() // must not panic
}

func TestAntigravityProvider_InstallHint(t *testing.T) {
	p := provider.NewAntigravity()
	hint := p.InstallHint()
	const wantURL = "https://antigravity.google/cli/install.sh"
	if !strings.Contains(hint, wantURL) {
		t.Errorf("InstallHint() = %q, expected to contain %q", hint, wantURL)
	}
}

func TestAntigravityProvider_BuildArgs_DefaultProfile(t *testing.T) {
	p := provider.NewAntigravity()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileDefault}
	args := p.BuildArgs("explain", "explain this", "some content", opts)

	// 최소한 -p 플래그와 값이 있어야 한다.
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

	// default profile: --dangerously-skip-permissions 가 있어야 한다.
	hasDSP := false
	for _, a := range args {
		if a == "--dangerously-skip-permissions" {
			hasDSP = true
		}
	}
	if !hasDSP {
		t.Errorf("BuildArgs() with default profile: expected --dangerously-skip-permissions flag, got %v", args)
	}
}

func TestAntigravityProvider_BuildArgs_UnrestrictedProfile(t *testing.T) {
	p := provider.NewAntigravity()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileUnrestricted}
	args := p.BuildArgs("explain", "explain this", "", opts)

	hasDSP := false
	for _, a := range args {
		if a == "--dangerously-skip-permissions" {
			hasDSP = true
		}
	}
	if !hasDSP {
		t.Errorf("BuildArgs() with unrestricted profile: expected --dangerously-skip-permissions flag, got %v", args)
	}
}

func TestAntigravityProvider_BuildArgs_RestrictedProfile(t *testing.T) {
	p := provider.NewAntigravity()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileRestricted}
	args := p.BuildArgs("explain", "explain this", "", opts)

	for _, a := range args {
		if a == "--dangerously-skip-permissions" {
			t.Errorf("BuildArgs() with restricted profile: --dangerously-skip-permissions must NOT be present, got %v", args)
		}
	}
}

func TestAntigravityProvider_BuildArgs_EmptyContent(t *testing.T) {
	p := provider.NewAntigravity()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileDefault}
	args := p.BuildArgs("explain", "just the prompt", "", opts)

	if args[1] != "just the prompt" {
		t.Errorf("args[1] = %q, want %q (no trailing newline when content is empty)", args[1], "just the prompt")
	}
}

// TestAntigravityProvider_BuildArgs_SeparatorDoubleNewline는 prompt와 content가 "\n\n"(double newline)으로
// 결합되는지 검증한다 (Node 구현과 동일한 동작: F-a parity fix).
func TestAntigravityProvider_BuildArgs_SeparatorDoubleNewline(t *testing.T) {
	p := provider.NewAntigravity()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileDefault}
	args := p.BuildArgs("explain", "the prompt", "the content", opts)

	const want = "the prompt\n\nthe content"
	if args[1] != want {
		t.Errorf("BuildArgs() combined = %q, want %q (separator must be \\n\\n not \\n)", args[1], want)
	}
}

func TestAntigravityProvider_BuildArgs_ModelIgnored(t *testing.T) {
	// agy에는 --model/-m 플래그가 없다. opts.Model 값을 지정해도 CLI 인수로 변환되지 않아야 한다.
	p := provider.NewAntigravity()
	opts := provider.InvokeOpts{
		PermissionProfile: provider.ProfileDefault,
		Model:             "some-model",
	}
	args := p.BuildArgs("explain", "explain this", "content", opts)

	for i, a := range args {
		if a == "--model" || a == "-m" {
			t.Errorf("BuildArgs() with Model set: model flag must NOT be passed (agy has no CLI model flag), got args[%d]=%q in %v", i, a, args)
		}
	}
}

func TestAntigravityProvider_BuildArgs_NoCwdFlag(t *testing.T) {
	// agy 1.0.3는 --cwd 플래그를 지원하지 않는다.
	p := provider.NewAntigravity()
	opts := provider.InvokeOpts{PermissionProfile: provider.ProfileDefault}
	args := p.BuildArgs("explain", "explain this", "", opts)

	for _, a := range args {
		if a == "--cwd" {
			t.Errorf("BuildArgs(): --cwd must NOT be passed (agy 1.0.3 rejects it), got %v", args)
		}
	}
}

func TestAntigravityProvider_IsAuthFailure(t *testing.T) {
	p := provider.NewAntigravity()

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
		{"stderr please run", 0, "please run agy login first", true},
		{"stderr PLEASE RUN uppercase", 0, "PLEASE RUN agy", true},
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

func TestAntigravityProvider_AuthHint(t *testing.T) {
	p := provider.NewAntigravity()
	hint := p.AuthHint()
	if !strings.Contains(hint, "agy") {
		t.Errorf("AuthHint() = %q, expected it to mention agy", hint)
	}
}
