package provider

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// AntigravityProvider implements Provider for the Antigravity CLI.
// Binary: agy (installed via curl -fsSL https://antigravity.google/cli/install.sh | bash)
// Auth:   OS Keyring (no API-key env, no creds file).
//
// Contract references: R-AVAIL-01, R-AUTH-04, R-SPAWN-01.
type AntigravityProvider struct{}

// NewAntigravity returns a new AntigravityProvider.
func NewAntigravity() Provider {
	return &AntigravityProvider{}
}

// Name returns the canonical provider key.
func (a *AntigravityProvider) Name() string { return "antigravity" }

// Binary returns the executable name to locate via PATH.
func (a *AntigravityProvider) Binary() string { return "agy" }

// IsAvailable reports whether the agy binary is present in PATH.
func (a *AntigravityProvider) IsAvailable() bool {
	_, err := exec.LookPath("agy")
	return err == nil
}

// InstallHint returns the human-readable install instructions (R-AVAIL-01).
func (a *AntigravityProvider) InstallHint() string {
	return "curl -fsSL https://antigravity.google/cli/install.sh | bash"
}

// BuildArgs constructs the CLI arguments for an agy invocation.
//
// The agy CLI accepts:
//
//	agy -p "<prompt>\n<content>" [--dangerously-skip-permissions]
//
// --dangerously-skip-permissions enables auto-approval of tool use. It is omitted
// when the permission profile is "restricted" (R-RUN-11, R-SPAWN-02).
//
// Note: agy has no --model/-m CLI flag; model selection is done out-of-band via
// the /model command within the agy session. opts.Model is intentionally ignored.
//
// Note: agy 1.0.3 rejects the --cwd flag; workspace is the process cwd.
func (a *AntigravityProvider) BuildArgs(command, prompt, content string, opts InvokeOpts) []string {
	combined := prompt
	if content != "" {
		combined = fmt.Sprintf("%s\n%s", prompt, content)
	}

	args := []string{"-p", combined}

	// Auto-approve tool use unless the caller requested a restricted profile.
	if opts.PermissionProfile != ProfileRestricted {
		args = append(args, "--dangerously-skip-permissions")
	}

	return args
}

// IsAuthFailure classifies exit code / stderr combinations as auth failures
// per R-AUTH-04 (antigravity-specific heuristics, mirrors gemini provider).
//
//  1. exit code 126 → auth failure (POSIX permission-denied sentinel)
//  2. stderr contains "unauthenticated" or "please run" (case-insensitive)
//  3. exit code 1 AND stderr contains "unauthenticated"
func (a *AntigravityProvider) IsAuthFailure(exitCode int, stderr string) bool {
	lower := strings.ToLower(stderr)

	if exitCode == 126 {
		return true
	}
	if strings.Contains(lower, "unauthenticated") || strings.Contains(lower, "please run") {
		return true
	}
	if exitCode == 1 && strings.Contains(lower, "unauthenticated") {
		return true
	}
	return false
}

// AuthHint returns the fix instruction for an Antigravity auth failure.
// Auth model: OS Keyring login via the agy binary itself.
func (a *AntigravityProvider) AuthHint() string {
	return "Run: agy  (OS Keyring/login)"
}

// CheckAuth performs a lightweight auth check by running "agy --version".
// Returns nil if the binary exits 0; returns *AuthError otherwise.
// Called by aco-install provider setup, NOT by aco run (R-AUTH-03).
func (a *AntigravityProvider) CheckAuth(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "agy", "--version")
	if err := cmd.Run(); err != nil {
		return &AuthError{
			Provider: a.Name(),
			Hint:     a.AuthHint(),
		}
	}
	return nil
}
