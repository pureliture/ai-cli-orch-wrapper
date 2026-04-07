package provider

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// GeminiProvider implements Provider for the Gemini CLI.
// Binary: gemini (installed via npm install -g @google/gemini-cli)
// Auth:   browser-based OAuth; GEMINI_API_KEY env var also accepted.
//
// Contract references: R-AVAIL-01, R-AUTH-04, R-SPAWN-01.
type GeminiProvider struct{}

// New returns a new GeminiProvider.
func NewGemini() Provider {
	return &GeminiProvider{}
}

// Name returns the canonical provider key.
func (g *GeminiProvider) Name() string { return "gemini" }

// Binary returns the executable name to locate via PATH.
func (g *GeminiProvider) Binary() string { return "gemini" }

// IsAvailable reports whether the gemini binary is present in PATH.
func (g *GeminiProvider) IsAvailable() bool {
	_, err := exec.LookPath("gemini")
	return err == nil
}

// InstallHint returns the human-readable install instructions (R-AVAIL-01).
func (g *GeminiProvider) InstallHint() string {
	return "npm install -g @google/gemini-cli"
}

// BuildArgs constructs the CLI arguments for a gemini invocation.
//
// The gemini CLI accepts:
//
//	gemini -p "<prompt>\n<content>" [--yolo]
//
// --yolo enables auto-approval of tool use. It is omitted when the
// permission profile is "restricted" (R-RUN-11, R-SPAWN-02).
func (g *GeminiProvider) BuildArgs(command, prompt, content string, opts InvokeOpts) []string {
	combined := prompt
	if content != "" {
		combined = fmt.Sprintf("%s\n%s", prompt, content)
	}

	args := []string{"-p", combined}

	// Auto-approve tool use unless the caller requested a restricted profile.
	if opts.PermissionProfile != ProfileRestricted {
		args = append(args, "--yolo")
	}

	return args
}

// IsAuthFailure classifies exit code / stderr combinations as auth failures
// per R-AUTH-04 (gemini-specific heuristics).
//
//  1. exit code 126 → auth failure (POSIX permission-denied sentinel)
//  2. stderr contains "unauthenticated" or "please run" (case-insensitive)
//  3. exit code 1 AND stderr contains "unauthenticated"
func (g *GeminiProvider) IsAuthFailure(exitCode int, stderr string) bool {
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

// AuthHint returns the fix instruction for a Gemini auth failure.
func (g *GeminiProvider) AuthHint() string {
	return "Run: gemini  (opens browser OAuth)"
}

// CheckAuth performs a lightweight auth check by running "gemini --version".
// Returns nil if the binary exits 0; returns *AuthError otherwise.
// Called by aco-install provider setup, NOT by aco run (R-AUTH-03).
func (g *GeminiProvider) CheckAuth(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "gemini", "--version")
	if err := cmd.Run(); err != nil {
		return &AuthError{
			Provider: g.Name(),
			Hint:     g.AuthHint(),
		}
	}
	return nil
}
