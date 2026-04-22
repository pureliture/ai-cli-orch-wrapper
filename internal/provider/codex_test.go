package provider

import (
	"strings"
	"testing"
)

func TestCodexProvider_Name(t *testing.T) {
	p := NewCodex()
	if p.Name() != "codex" {
		t.Errorf("Name() = %q, want %q", p.Name(), "codex")
	}
}

func TestCodexProvider_Binary(t *testing.T) {
	p := NewCodex()
	if p.Binary() != "codex" {
		t.Errorf("Binary() = %q, want %q", p.Binary(), "codex")
	}
}

func TestCodexProvider_IsAvailable_Stub(t *testing.T) {
	p := NewCodex()
	_ = p.IsAvailable() // must not panic — binary may or may not be present in CI
}

func TestCodexProvider_InstallHint(t *testing.T) {
	p := NewCodex()
	hint := p.InstallHint()
	if !strings.Contains(hint, "codex") {
		t.Errorf("InstallHint() = %q, expected it to mention codex", hint)
	}
}

func TestCodexProvider_BuildArgs_ModelSet(t *testing.T) {
	p := NewCodex()
	opts := InvokeOpts{Model: "gpt-5.4"}
	args := p.BuildArgs("explain", "explain this", "some content", opts)

	hasModel := false
	for i, a := range args {
		if a == "--model" && i+1 < len(args) {
			if args[i+1] == "gpt-5.4" {
				hasModel = true
			}
		}
	}
	if !hasModel {
		t.Errorf("BuildArgs() with Model set: expected --model gpt-5.4, got %v", args)
	}
}

func TestCodexProvider_BuildArgs_ReasoningEffortNotPassed(t *testing.T) {
	p := NewCodex()
	opts := InvokeOpts{ReasoningEffort: "high"}
	args := p.BuildArgs("explain", "explain this", "", opts)

	for _, a := range args {
		if a == "--reasoning-effort" {
			t.Errorf("BuildArgs() with ReasoningEffort set: --reasoning-effort must NOT be passed, got %v", args)
		}
	}
}

func TestCodexProvider_BuildArgs_NonRestrictedProfile_IncludesFullAuto(t *testing.T) {
	p := NewCodex()

	for _, profile := range []PermissionProfile{ProfileDefault, ProfileUnrestricted} {
		opts := InvokeOpts{PermissionProfile: profile}
		args := p.BuildArgs("explain", "explain this", "", opts)

		hasFullAuto := false
		for _, a := range args {
			if a == "--full-auto" {
				hasFullAuto = true
			}
		}
		if !hasFullAuto {
			t.Errorf("BuildArgs() with profile %q: expected --full-auto flag, got %v", profile, args)
		}
	}
}

func TestCodexProvider_BuildArgs_RestrictedProfile_NoFullAuto(t *testing.T) {
	p := NewCodex()
	opts := InvokeOpts{PermissionProfile: ProfileRestricted}
	args := p.BuildArgs("explain", "explain this", "", opts)

	for _, a := range args {
		if a == "--full-auto" {
			t.Errorf("BuildArgs() with restricted profile: --full-auto must NOT be present, got %v", args)
		}
	}
}

func TestCodexProvider_BuildArgs_ExecAndSkipGitRepoCheck(t *testing.T) {
	p := NewCodex()
	opts := InvokeOpts{PermissionProfile: ProfileDefault}
	args := p.BuildArgs("explain", "explain this", "", opts)

	if len(args) < 2 {
		t.Fatalf("BuildArgs() returned too few args: %v", args)
	}
	if args[0] != "exec" {
		t.Errorf("args[0] = %q, want %q", args[0], "exec")
	}
	if args[1] != "--skip-git-repo-check" {
		t.Errorf("args[1] = %q, want %q", args[1], "--skip-git-repo-check")
	}
}

func TestCodexProvider_IsAuthFailure(t *testing.T) {
	p := NewCodex()

	cases := []struct {
		name     string
		exitCode int
		stderr   string
		want     bool
	}{
		{"exit 401", 401, "", true},
		{"exit 403", 403, "", true},
		{"exit 0 clean", 0, "", false},
		{"exit 1 random stderr", 1, "some error", false},
		{"stderr Unauthorized", 1, "Unauthorized access", true},
		{"stderr Authentication failed", 1, "Authentication failed", true},
		{"exit 0 with unauthorized in stderr", 0, "Unauthorized", false},
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

func TestCodexProvider_AuthHint(t *testing.T) {
	p := NewCodex()
	hint := p.AuthHint()
	if !strings.Contains(hint, "codex login") {
		t.Errorf("AuthHint() = %q, expected it to mention codex login", hint)
	}
}

func TestCodexProvider_BuildArgs_ExtraArgsPassThrough(t *testing.T) {
	p := NewCodex()
	opts := InvokeOpts{
		PermissionProfile: ProfileDefault,
		ExtraArgs:         []string{"--verbose", "--debug"},
	}
	args := p.BuildArgs("explain", "explain this", "", opts)

	hasVerbose := false
	hasDebug := false
	for _, a := range args {
		if a == "--verbose" {
			hasVerbose = true
		}
		if a == "--debug" {
			hasDebug = true
		}
	}
	if !hasVerbose {
		t.Errorf("BuildArgs() with ExtraArgs: expected --verbose in args, got %v", args)
	}
	if !hasDebug {
		t.Errorf("BuildArgs() with ExtraArgs: expected --debug in args, got %v", args)
	}
}

func TestCodexProvider_BuildArgs_ExtraArgs_UnsupportedFiltered(t *testing.T) {
	p := NewCodex()
	opts := InvokeOpts{
		PermissionProfile: ProfileDefault,
		ExtraArgs:          []string{"--verbose", "--reasoning-effort", "high", "--debug"},
	}
	args := p.BuildArgs("explain", "explain this", "", opts)

	for _, a := range args {
		if a == "--reasoning-effort" {
			t.Errorf("BuildArgs() with ExtraArgs containing --reasoning-effort: flag must be filtered out, got %v", args)
		}
	}
}

func containsString(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
