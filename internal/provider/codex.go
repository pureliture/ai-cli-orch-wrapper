package provider

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

// CodexProvider implements Provider for the Codex CLI.
type CodexProvider struct{}

func NewCodex() Provider {
	return &CodexProvider{}
}

func (c *CodexProvider) Name() string   { return "codex" }
func (c *CodexProvider) Binary() string { return "codex" }

func (c *CodexProvider) IsAvailable() bool {
	_, err := exec.LookPath(c.Binary())
	return err == nil
}

func (c *CodexProvider) InstallHint() string {
	return "npm install -g @openai/codex"
}

func (c *CodexProvider) BuildArgs(_ string, prompt, content string, opts InvokeOpts) []string {
	combined := prompt
	if content != "" {
		if combined != "" {
			combined += "\n\n"
		}
		combined += content
	}

	args := []string{"exec", "--skip-git-repo-check"}
	if opts.PermissionProfile != ProfileRestricted {
		args = append(args, "--full-auto")
	}
	if opts.Model != "" {
		args = append(args, "--model", opts.Model)
	}
	args = append(args, filterUnsupportedArgs(opts.ExtraArgs)...)
	args = append(args, combined)
	return args
}

func (c *CodexProvider) IsAuthFailure(exitCode int, stderr string) bool {
	if exitCode == 401 || exitCode == 403 {
		return true
	}
	if exitCode != 0 && (strings.Contains(stderr, "Unauthorized") || strings.Contains(stderr, "Authentication failed")) {
		return true
	}
	return false
}

func (c *CodexProvider) AuthHint() string {
	return "Run: codex login"
}

func (c *CodexProvider) CheckAuth(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "codex", "--version")
	if err := cmd.Run(); err != nil {
		return &AuthError{Provider: c.Name(), Hint: c.AuthHint()}
	}
	return nil
}
