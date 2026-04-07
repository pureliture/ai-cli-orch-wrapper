package delegate

import "testing"

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
