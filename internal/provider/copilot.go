package provider

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// CopilotProvider implements Provider for the GitHub Copilot CLI.
// Binary: copilot (installed via brew install copilot-cli or npm install -g @github/copilot)
// Auth:   GitHub OAuth via gh auth login / GH_TOKEN env var.
//
// Contract references: R-AVAIL-01, R-AUTH-04, R-SPAWN-01.
type CopilotProvider struct{}

// NewCopilot returns a new CopilotProvider.
func NewCopilot() Provider {
	return &CopilotProvider{}
}

// Name returns the canonical provider key.
func (c *CopilotProvider) Name() string { return "copilot" }

// Binary returns the executable name to locate via PATH.
func (c *CopilotProvider) Binary() string { return "copilot" }

// IsAvailable reports whether the copilot binary is present in PATH.
func (c *CopilotProvider) IsAvailable() bool {
	_, err := exec.LookPath("copilot")
	return err == nil
}

// InstallHint returns the human-readable install instructions (R-AVAIL-01).
func (c *CopilotProvider) InstallHint() string {
	return "brew install copilot-cli  # or: npm install -g @github/copilot"
}

// BuildArgs constructs the CLI arguments for a copilot invocation.
//
// The GitHub Copilot CLI accepts:
//
//	copilot suggest -s "<prompt>\n<content>"
//
// The -s / --shell-out flag requests a shell command suggestion with the
// given free-form description. When content is provided it is appended to
// the prompt so that the model sees both the instruction and the input.
func (c *CopilotProvider) BuildArgs(command, prompt, content string, opts InvokeOpts) []string {
	combined := prompt
	if content != "" {
		combined = fmt.Sprintf("%s\n%s", prompt, content)
	}

	// "copilot suggest" is the interactive suggestion subcommand.
	// -s / --shell-out passes the description non-interactively.
	return []string{"suggest", "-s", combined}
}

// IsAuthFailure classifies exit code / stderr combinations as auth failures
// per R-AUTH-04 (copilot-specific heuristics).
//
//  1. exit code 126 → auth failure (POSIX permission-denied sentinel)
//  2. stderr contains any of: "unauthorized", "authentication", "login",
//     "token", "credential" (case-insensitive substring match)
func (c *CopilotProvider) IsAuthFailure(exitCode int, stderr string) bool {
	if exitCode == 126 {
		return true
	}

	lower := strings.ToLower(stderr)
	authKeywords := []string{
		"unauthorized",
		"authentication",
		"login",
		"token",
		"credential",
	}
	for _, kw := range authKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

// AuthHint returns the fix instruction for a Copilot auth failure.
func (c *CopilotProvider) AuthHint() string {
	return "Run: copilot login  # or: gh auth login"
}

// CheckAuth performs a lightweight auth check by running "gh auth status".
// Returns nil if gh exits 0; returns *AuthError otherwise.
// Called by aco-install provider setup, NOT by aco run (R-AUTH-03).
//
// The copilot CLI delegates authentication to the GitHub CLI (gh), so
// "gh auth status" is the canonical pre-flight health check (R-AUTH-04).
func (c *CopilotProvider) CheckAuth(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "gh", "auth", "status")
	if err := cmd.Run(); err != nil {
		return &AuthError{
			Provider: c.Name(),
			Hint:     c.AuthHint(),
		}
	}
	return nil
}
