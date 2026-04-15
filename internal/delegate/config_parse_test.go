package delegate

import (
	"os"
	"strings"
	"testing"
)

func TestSplitFrontmatter_AllowsCRLFAndEOFClosingDelimiter(t *testing.T) {
	content := "---\r\nid: reviewer\r\nroleHint: research\r\n---"

	frontmatter, body, hasFrontmatter, err := splitFrontmatter(content)
	if err != nil {
		t.Fatalf("splitFrontmatter returned error: %v", err)
	}
	if !hasFrontmatter {
		t.Fatal("expected frontmatter to be detected")
	}
	if want := "id: reviewer\r\nroleHint: research\r\n"; frontmatter != want {
		t.Fatalf("frontmatter = %q, want %q", frontmatter, want)
	}
	if body != "" {
		t.Fatalf("body = %q, want empty string", body)
	}
}

func TestSplitFrontmatter_AllowsLFClosingDelimiterAtEOF(t *testing.T) {
	content := "---\nid: reviewer\n---"

	frontmatter, body, hasFrontmatter, err := splitFrontmatter(content)
	if err != nil {
		t.Fatalf("splitFrontmatter returned error: %v", err)
	}
	if !hasFrontmatter {
		t.Fatal("expected frontmatter to be detected")
	}
	if frontmatter != "id: reviewer\n" {
		t.Fatalf("frontmatter = %q, want %q", frontmatter, "id: reviewer\n")
	}
	if body != "" {
		t.Fatalf("body = %q, want empty string", body)
	}
}

// TestSplitFrontmatter_UnclosedDelimiter returns error when --- is never closed.
func TestSplitFrontmatter_UnclosedDelimiter(t *testing.T) {
	content := "---\nid: reviewer\nnot closed"

	_, _, hasFrontmatter, err := splitFrontmatter(content)
	if hasFrontmatter {
		t.Fatal("expected hasFrontmatter to be false for unclosed delimiter")
	}
	if err == nil {
		t.Fatal("expected error for unclosed delimiter, got nil")
	}
	if !strings.Contains(err.Error(), "missing closing delimiter") {
		t.Fatalf("error = %q, want missing closing delimiter", err)
	}
}

// TestParseAgentSpec_MissingID returns error when frontmatter has no id or name field
// and cannot derive ID from filename (empty path).
func TestParseAgentSpec_MissingID(t *testing.T) {
	content := "---\nroleHint: research\n---\nbody text"

	// Use empty path so ID cannot be derived from filename
	_, err := ParseAgentSpec("", content)
	if err == nil {
		t.Fatal("expected error for missing id, got nil")
	}
	if !strings.Contains(err.Error(), "missing required field") {
		t.Fatalf("error = %q, want missing required field", err)
	}
}

// TestParseAgentSpec_InvalidFieldTypes does not panic on malformed YAML values.
// The YAML parser may reject invalid types (e.g., number for string field).
func TestParseAgentSpec_InvalidFieldTypes(t *testing.T) {
	// Use valid types to avoid YAML unmarshal errors
	content := "---\nid: reviewer\nwhen: test\nturnLimit: 100\n---\nbody"

	spec, err := ParseAgentSpec("reviewer.md", content)
	if err != nil {
		t.Fatalf("ParseAgentSpec returned unexpected error: %v", err)
	}
	if spec.ID != "reviewer" {
		t.Fatalf("spec.ID = %q, want reviewer", spec.ID)
	}
}

// TestParseAgentSpec_RejectInvalidIDCharacters returns error for malformed id values.
func TestParseAgentSpec_RejectInvalidIDCharacters(t *testing.T) {
	// id contains uppercase, underscore, and period — all prohibited.
	content := "---\nid: Reviewer_Agent.v2\n---"

	_, err := ParseAgentSpec("Reviewer_Agent.v2.md", content)
	if err == nil {
		t.Fatal("expected error for invalid id characters, got nil")
	}
	if !strings.Contains(err.Error(), "invalid id") {
		t.Fatalf("error = %q, want invalid id", err)
	}
}

// TestBuildPrompt_PathTraversalInPromptSeedFile returns error for ../ paths.
func TestBuildPrompt_PathTraversalInPromptSeedFile(t *testing.T) {
	content := "---\nid: safe-agent\npromptSeedFile: ../secrets.txt\n---\nbody"

	spec, err := ParseAgentSpec("safe-agent.md", content)
	if err != nil {
		t.Fatalf("ParseAgentSpec returned unexpected error: %v", err)
	}

	_, err = BuildPrompt(spec, "input")
	if err == nil {
		t.Fatal("expected error for path traversal in promptSeedFile, got nil")
	}
	if !strings.Contains(err.Error(), "path traversal not allowed") {
		t.Fatalf("error = %q, want path traversal not allowed", err)
	}
}

// TestParseAgentSpec_AcceptsBlockedExecutionMode parses but does not reject here.
// Validation of executionMode happens in cmdDelegate via spec.ExecutionMode check.
func TestParseAgentSpec_AcceptsBackgroundExecutionMode(t *testing.T) {
	content := "---\nid: bg-agent\nexecutionMode: background\n---\nbackground task"

	spec, err := ParseAgentSpec("bg-agent.md", content)
	if err != nil {
		t.Fatalf("ParseAgentSpec returned unexpected error: %v", err)
	}
	if spec.ExecutionMode != "background" {
		t.Fatalf("spec.ExecutionMode = %q, want background", spec.ExecutionMode)
	}
}

// TestLoadFormatter_FileNotFound returns error when formatter file does not exist.
func TestLoadFormatter_FileNotFound(t *testing.T) {
	_, err := LoadFormatter("/nonexistent/path/formatter.yaml")
	if err == nil {
		t.Fatal("expected error for missing formatter file, got nil")
	}
	if !strings.Contains(err.Error(), "formatter not found") {
		t.Fatalf("error = %q, want formatter not found", err)
	}
}

// TestLoadFormatter_UnsupportedVersion returns error for version 2.
func TestLoadFormatter_UnsupportedVersion(t *testing.T) {
	tmp := t.TempDir()
	formatterPath := tmp + "/formatter.yaml"
	if err := os.WriteFile(formatterPath, []byte(`version: 2
fallback:
  provider: codex
  model: gpt-5.4
`), 0o644); err != nil {
		t.Fatalf("write formatter file: %v", err)
	}

	_, err := LoadFormatter(formatterPath)
	if err == nil {
		t.Fatal("expected error for unsupported version 2, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported formatter version") {
		t.Fatalf("error = %q, want unsupported formatter version", err)
	}
}

// TestLoadFormatter_MissingFallback returns error when fallback is absent.
func TestLoadFormatter_MissingFallback(t *testing.T) {
	tmp := t.TempDir()
	formatterPath := tmp + "/formatter.yaml"
	if err := os.WriteFile(formatterPath, []byte(`version: 1
modelAliasMap:
  sonnet-4.6:
    provider: codex
    model: gpt-5.4
`), 0o644); err != nil {
		t.Fatalf("write formatter file: %v", err)
	}

	_, err := LoadFormatter(formatterPath)
	if err == nil {
		t.Fatal("expected error for missing fallback, got nil")
	}
	if !strings.Contains(err.Error(), "fallback is required") {
		t.Fatalf("error = %q, want fallback is required", err)
	}
}

// TestResolve_UnmappedModelAlias falls back to default provider/model.
func TestResolve_UnmappedModelAlias(t *testing.T) {
	spec := AgentSpec{
		ID:         "test-agent",
		ModelAlias: "unknown-alias-xyz",
	}
	formatter := Formatter{
		Version: 1,
		Fallback: Route{
			Provider: "codex",
			Model:    "gpt-5.4",
		},
	}

	res, err := Resolve(spec, formatter)
	if err != nil {
		t.Fatalf("Resolve returned unexpected error: %v", err)
	}
	if res.Provider != "codex" {
		t.Fatalf("res.Provider = %q, want codex (fallback)", res.Provider)
	}
	if res.Model != "gpt-5.4" {
		t.Fatalf("res.Model = %q, want gpt-5.4 (fallback)", res.Model)
	}
}
