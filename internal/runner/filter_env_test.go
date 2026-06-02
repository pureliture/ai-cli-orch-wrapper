package runner

import (
	"testing"
)

// TestFilterEnvForAllowlist_Antigravity_ExcludesAuth verifies that antigravity
// (OS Keyring 인증 방식) 는 auth 환경변수를 받지 않는다.
// Node buildProviderEnv([]) 동작과의 parity 검증.
func TestFilterEnvForAllowlist_Antigravity_ExcludesAuth(t *testing.T) {
	env := []string{
		"GITHUB_TOKEN=x",
		"ANTHROPIC_API_KEY=y",
		"PATH=/bin",
		"OPENAI_API_KEY=z",
		"SECRET_FOO=bar",
	}

	got := filterEnvForAllowlist(env, "antigravity")

	contains := func(key string) bool {
		for _, e := range got {
			if len(e) > len(key) && e[:len(key)+1] == key+"=" {
				return true
			}
		}
		return false
	}

	if !contains("PATH") {
		t.Errorf("antigravity: PATH should be present, got %v", got)
	}
	if contains("GITHUB_TOKEN") {
		t.Errorf("antigravity: GITHUB_TOKEN must NOT be present (auth leak), got %v", got)
	}
	if contains("ANTHROPIC_API_KEY") {
		t.Errorf("antigravity: ANTHROPIC_API_KEY must NOT be present (auth leak), got %v", got)
	}
	if contains("OPENAI_API_KEY") {
		t.Errorf("antigravity: OPENAI_API_KEY must NOT be present (not in any allowlist), got %v", got)
	}
}

// TestFilterEnvForAllowlist_Codex_KeepsAuth verifies that codex (and other
// non-antigravity providers) still receive auth env vars — legacy behavior unchanged.
func TestFilterEnvForAllowlist_Codex_KeepsAuth(t *testing.T) {
	env := []string{
		"GITHUB_TOKEN=tok",
		"ANTHROPIC_API_KEY=key",
		"PATH=/usr/bin",
		"OPENAI_API_KEY=oai",
		"SECRET_FOO=bar",
	}

	got := filterEnvForAllowlist(env, "codex")

	contains := func(key string) bool {
		for _, e := range got {
			if len(e) > len(key) && e[:len(key)+1] == key+"=" {
				return true
			}
		}
		return false
	}

	if !contains("GITHUB_TOKEN") {
		t.Errorf("codex: GITHUB_TOKEN should be present, got %v", got)
	}
	if !contains("ANTHROPIC_API_KEY") {
		t.Errorf("codex: ANTHROPIC_API_KEY should be present, got %v", got)
	}
	if !contains("PATH") {
		t.Errorf("codex: PATH should be present, got %v", got)
	}
	// OPENAI_API_KEY is never in any allowlist
	if contains("OPENAI_API_KEY") {
		t.Errorf("codex: OPENAI_API_KEY must NOT be present (not in any allowlist), got %v", got)
	}
}

// TestFilterEnvForAllowlist_DropsUnlisted verifies that arbitrary env vars
// not in any allowlist are dropped for all providers.
func TestFilterEnvForAllowlist_DropsUnlisted(t *testing.T) {
	env := []string{
		"SECRET_FOO=bar",
		"RANDOM_VAR=value",
		"PATH=/bin",
	}

	for _, provider := range []string{"antigravity", "codex", "mock"} {
		got := filterEnvForAllowlist(env, provider)
		for _, e := range got {
			if len(e) >= 10 && e[:10] == "SECRET_FOO" {
				t.Errorf("provider %q: SECRET_FOO must be dropped, got %v", provider, got)
			}
			if len(e) >= 10 && e[:10] == "RANDOM_VAR" {
				t.Errorf("provider %q: RANDOM_VAR must be dropped, got %v", provider, got)
			}
		}
	}
}
