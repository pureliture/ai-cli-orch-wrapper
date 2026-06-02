package delegate

import (
	"testing"
)

// baseFormatterForNoModelTests constructs a Formatter that mirrors .aco/formatter.yaml:
//   - opus/haiku alias → {antigravity, ""} (no-model provider)
//   - research roleHint → preferredProvider antigravity
//   - providerModels.antigravity = present with nil slice, mirroring the real YAML key
//     (body is comments only → nil; len()==0 → treated as a no-model provider)
//   - providerModels.codex = ["gpt-5.4"]
//   - providerDefaults.antigravity.launchArgs = ["--sandbox"]
//   - fallback = {codex, gpt-5.4}
func baseFormatterForNoModelTests() Formatter {
	return Formatter{
		Version: 1,
		ModelAliasMap: map[string]Route{
			"opus":  {Provider: "antigravity", Model: ""},
			"haiku": {Provider: "antigravity", Model: ""},
		},
		RoleHintRules: map[string]RoleHintRule{
			"research": {PreferredProvider: "antigravity"},
			"execute":  {PreferredProvider: "codex"},
		},
		ProviderModels: map[string][]string{
			"codex":       {"gpt-5.4"},
			"antigravity": nil, // present key with nil slice (mirrors real YAML: comments-only → nil; len()==0 → no-model)
		},
		ProviderDefaults: map[string]ProviderDefault{
			"antigravity": {LaunchArgs: []string{"--sandbox"}},
			"codex":       {LaunchArgs: []string{}},
		},
		Fallback: Route{
			Provider: "codex",
			Model:    "gpt-5.4",
		},
	}
}

// TestResolve_ResearcherSpec tests the researcher-style spec:
// {ModelAlias:"opus", RoleHint:"research"} should route to antigravity with empty model,
// NOT fall back to codex. This is the P1 regression test.
func TestResolve_ResearcherSpecRoutesToAntigravity(t *testing.T) {
	spec := AgentSpec{
		ID:         "researcher",
		ModelAlias: "opus",
		RoleHint:   "research",
	}
	formatter := baseFormatterForNoModelTests()

	res, err := Resolve(spec, formatter)
	if err != nil {
		t.Fatalf("Resolve returned unexpected error: %v", err)
	}
	if res.Provider != "antigravity" {
		t.Fatalf("res.Provider = %q, want antigravity (regression: got codex fallback instead)", res.Provider)
	}
	if res.Model != "" {
		t.Fatalf("res.Model = %q, want empty string (agy is no-model provider)", res.Model)
	}
	// LaunchArgs should contain --sandbox from providerDefaults.antigravity
	found := false
	for _, arg := range res.LaunchArgs {
		if arg == "--sandbox" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("res.LaunchArgs = %v, want to contain --sandbox", res.LaunchArgs)
	}
}

// TestResolve_NoModelAliasNoRoleHint tests that a no-model alias without roleHint
// resolves to antigravity with empty model (not codex fallback).
func TestResolve_HaikuAliasNoRoleHintRoutesToAntigravity(t *testing.T) {
	spec := AgentSpec{
		ID:         "some-agent",
		ModelAlias: "haiku",
	}
	formatter := baseFormatterForNoModelTests()

	res, err := Resolve(spec, formatter)
	if err != nil {
		t.Fatalf("Resolve returned unexpected error: %v", err)
	}
	if res.Provider != "antigravity" {
		t.Fatalf("res.Provider = %q, want antigravity", res.Provider)
	}
	if res.Model != "" {
		t.Fatalf("res.Model = %q, want empty string", res.Model)
	}
}

// TestResolve_UnknownProviderEmptyModelFallsBack is a safety test:
// a spec routing to an unknown provider with empty model should still fall back
// to {codex, gpt-5.4}. requiresModel must return true for unknown providers.
func TestResolve_UnknownProviderEmptyModelFallsBack(t *testing.T) {
	spec := AgentSpec{
		ID:         "ghost-agent",
		ModelAlias: "ghost-alias",
	}
	formatter := Formatter{
		Version: 1,
		ModelAliasMap: map[string]Route{
			"ghost-alias": {Provider: "ghost", Model: ""},
		},
		ProviderModels: map[string][]string{
			"codex": {"gpt-5.4"},
			// "ghost" is intentionally absent from providerModels
		},
		ProviderDefaults: map[string]ProviderDefault{},
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
		t.Fatalf("res.Provider = %q, want codex (fallback for unknown provider)", res.Provider)
	}
	if res.Model != "gpt-5.4" {
		t.Fatalf("res.Model = %q, want gpt-5.4 (fallback)", res.Model)
	}
}
