// Package prompt resolves provider prompt text using a three-tier hierarchy
// defined in R-RUN-12:
//
//  1. ./.claude/aco/prompts/<provider>/<command>.md  (cwd-local override)
//  2. ~/.claude/aco/prompts/<provider>/<command>.md  (global)
//  3. Embedded default (compiled into binary via embed.FS)
//
// The embedded default is the source of truth for the binary.
// No warning is emitted when the embedded default is used.
package prompt

import (
	"fmt"
	"os"
	"path/filepath"
)

// Load resolves the prompt text for the given provider and command.
// cwd is the working directory for the cwd-local search (usually os.Getwd()).
func Load(cwd, provider, command string) (string, error) {
	rel := filepath.Join(".claude", "aco", "prompts", provider, command+".md")

	// 1. cwd-local override
	if cwd != "" {
		if data, err := os.ReadFile(filepath.Join(cwd, rel)); err == nil {
			return string(data), nil
		}
	}

	// 2. Global override
	if home, err := os.UserHomeDir(); err == nil {
		if data, err := os.ReadFile(filepath.Join(home, rel)); err == nil {
			return string(data), nil
		}
	}

	// 3. Embedded default
	return loadEmbedded(provider, command)
}

// loadEmbedded returns the embedded default prompt for the given provider+command.
// Returns an error if no embedded prompt exists for the combination.
func loadEmbedded(provider, command string) (string, error) {
	key := provider + "-" + command
	p, ok := embeddedDefaults[key]
	if !ok {
		// Fallback: generic prompt that is better than the old hardcoded Node string.
		return fmt.Sprintf(
			"You are a code review assistant delegated from Claude Code.\n"+
				"Perform a %s for the provided content. Be specific and actionable.",
			command,
		), nil
	}
	return p, nil
}
