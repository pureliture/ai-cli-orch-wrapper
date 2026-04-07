package delegate

import (
	"strings"
	"testing"
)

func TestBuildMarshaledPrompt_IncludesTaskBranchAndDiff(t *testing.T) {
	prompt := BuildMarshaledPrompt("review this patch", "feature/aco-v2", "diff --git a/a b/a\n+change\n", 50000)

	if !strings.Contains(prompt, "## Task\nreview this patch") {
		t.Fatalf("prompt missing task section: %q", prompt)
	}
	if !strings.Contains(prompt, "## Branch\nfeature/aco-v2") {
		t.Fatalf("prompt missing branch section: %q", prompt)
	}
	if !strings.Contains(prompt, "## Changes\n```diff\ndiff --git a/a b/a\n+change\n```") {
		t.Fatalf("prompt missing diff block: %q", prompt)
	}
}

func TestBuildMarshaledPrompt_TruncatesLargeDiff(t *testing.T) {
	largeDiff := strings.Repeat("x", 50010)

	prompt := BuildMarshaledPrompt("task", "main", largeDiff, 50000)

	if !strings.Contains(prompt, "[truncated]") {
		t.Fatalf("prompt missing truncation marker: %q", prompt)
	}
	if strings.Contains(prompt, largeDiff) {
		t.Fatal("prompt should not contain the full diff after truncation")
	}
}

func TestBuildMarshaledPrompt_ToleratesMissingGitContext(t *testing.T) {
	prompt := BuildMarshaledPrompt("task", "", "", 50000)

	if !strings.Contains(prompt, "## Branch\n") {
		t.Fatalf("prompt missing branch header: %q", prompt)
	}
	if !strings.Contains(prompt, "## Changes\n```diff\n\n```") {
		t.Fatalf("prompt missing empty diff block: %q", prompt)
	}
}
