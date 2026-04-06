package provider

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// GeminiCLIProvider implements Provider for the Gemini CLI.
type GeminiCLIProvider struct{}

func NewGeminiCLI() Provider {
	return &GeminiCLIProvider{}
}

func (g *GeminiCLIProvider) Name() string   { return "gemini_cli" }
func (g *GeminiCLIProvider) Binary() string { return "gemini" }

func (g *GeminiCLIProvider) IsAvailable() bool {
	_, err := exec.LookPath(g.Binary())
	return err == nil
}

func (g *GeminiCLIProvider) InstallHint() string {
	return "npm install -g @google/gemini-cli"
}

func (g *GeminiCLIProvider) BuildArgs(_ string, prompt, content string, opts InvokeOpts) []string {
	combined := prompt
	if content != "" {
		if combined != "" {
			combined += "\n\n"
		}
		combined += content
	}

	args := []string{}
	if opts.Model != "" {
		args = append(args, "--model", opts.Model)
	}
	if opts.ReasoningEffort != "" {
		args = append(args, "--reasoning-effort", opts.ReasoningEffort)
	}
	args = append(args, "--prompt", combined)
	args = append(args, opts.ExtraArgs...)
	return args
}

func (g *GeminiCLIProvider) IsAuthFailure(exitCode int, stderr string) bool {
	lower := strings.ToLower(stderr)
	return exitCode == 126 || strings.Contains(lower, "unauthenticated") || strings.Contains(lower, "please run")
}

func (g *GeminiCLIProvider) AuthHint() string {
	return "Run: gemini"
}

func (g *GeminiCLIProvider) CheckAuth(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "gemini", "--version")
	if err := cmd.Run(); err != nil {
		return &AuthError{
			Provider: g.Name(),
			Hint:     fmt.Sprintf("%s  (opens browser OAuth)", g.AuthHint()),
		}
	}
	return nil
}
