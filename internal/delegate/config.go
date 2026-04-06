package delegate

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

var agentIDPattern = regexp.MustCompile(`^[a-z0-9-]+$`)

type AgentSpec struct {
	Path              string
	ID                string   `yaml:"id"`
	When              string   `yaml:"when"`
	ModelAlias        string   `yaml:"modelAlias"`
	RoleHint          string   `yaml:"roleHint"`
	PermissionProfile string   `yaml:"permissionProfile"`
	TurnLimit         int      `yaml:"turnLimit"`
	ExecutionMode     string   `yaml:"executionMode"`
	WorkspaceMode     string   `yaml:"workspaceMode"`
	IsolationMode     string   `yaml:"isolationMode"`
	PromptSeedFile    string   `yaml:"promptSeedFile"`
	ReasoningEffort   string   `yaml:"reasoningEffort"`
	SkillRefs         []string `yaml:"skillRefs"`
	MemoryRefs        []string `yaml:"memoryRefs"`
	Body              string
}

type Formatter struct {
	Version          int                            `yaml:"version"`
	ProviderDefaults map[string]ProviderDefault     `yaml:"providerDefaults"`
	ModelAliasMap    map[string]Route               `yaml:"modelAliasMap"`
	EffortMap        map[string]map[string]string   `yaml:"effortMap"`
	RoleHintRules    map[string]RoleHintRule        `yaml:"roleHintRules"`
	Fallback         Route                          `yaml:"fallback"`
	ProviderModels   map[string][]string            `yaml:"providerModels"`
}

type ProviderDefault struct {
	LaunchArgs []string `yaml:"launchArgs"`
}

type RoleHintRule struct {
	PreferredProvider string `yaml:"preferredProvider"`
}

type Route struct {
	Provider string `yaml:"provider"`
	Model    string `yaml:"model"`
}

type Resolution struct {
	Provider        string
	Model           string
	LaunchArgs      []string
	ReasoningEffort string
}

func LoadAgentSpec(agentsDir, agentID string) (AgentSpec, error) {
	specPath := filepath.Join(agentsDir, agentID+".md")
	data, err := os.ReadFile(specPath)
	if err != nil {
		return AgentSpec{}, fmt.Errorf("agent spec not found: %s", specPath)
	}
	spec, err := ParseAgentSpec(specPath, string(data))
	if err != nil {
		return AgentSpec{}, err
	}
	if spec.ID != "" && spec.ID != agentID {
		return AgentSpec{}, fmt.Errorf("agent id mismatch: frontmatter id %q does not match %q", spec.ID, agentID)
	}
	spec.Path = specPath
	return spec, nil
}

func ParseAgentSpec(path, content string) (AgentSpec, error) {
	spec := AgentSpec{
		Path:              path,
		PermissionProfile: "default",
		ExecutionMode:     "blocking",
		WorkspaceMode:     "read-only",
		IsolationMode:     "none",
	}
	frontmatter, body, hasFrontmatter, err := splitFrontmatter(content)
	if err != nil {
		return AgentSpec{}, err
	}
	if !hasFrontmatter {
		spec.Body = strings.TrimSpace(content)
		return spec, nil
	}
	if err := yaml.Unmarshal([]byte(frontmatter), &spec); err != nil {
		return AgentSpec{}, fmt.Errorf("parse frontmatter: %w", err)
	}
	spec.Body = strings.TrimSpace(body)
	if spec.ID == "" {
		return AgentSpec{}, errors.New("parse frontmatter: missing required field \"id\"")
	}
	if !agentIDPattern.MatchString(spec.ID) {
		return AgentSpec{}, fmt.Errorf("parse frontmatter: invalid id %q", spec.ID)
	}
	if spec.ExecutionMode == "" {
		spec.ExecutionMode = "blocking"
	}
	if spec.PermissionProfile == "" {
		spec.PermissionProfile = "default"
	}
	if spec.WorkspaceMode == "" {
		spec.WorkspaceMode = "read-only"
	}
	if spec.IsolationMode == "" {
		spec.IsolationMode = "none"
	}
	return spec, nil
}

func LoadFormatter(path string) (Formatter, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Formatter{}, fmt.Errorf("formatter not found: %s", path)
	}
	var formatter Formatter
	if err := yaml.Unmarshal(data, &formatter); err != nil {
		return Formatter{}, fmt.Errorf("parse formatter: %w", err)
	}
	if formatter.Version != 1 {
		return Formatter{}, fmt.Errorf("unsupported formatter version %d", formatter.Version)
	}
	if formatter.Fallback.Provider == "" || formatter.Fallback.Model == "" {
		return Formatter{}, errors.New("formatter fallback is required")
	}
	return formatter, nil
}

func DefaultFormatter() Formatter {
	return Formatter{
		Version: 1,
		Fallback: Route{
			Provider: "codex",
			Model:    "gpt-5.4",
		},
	}
}

func Resolve(spec AgentSpec, formatter Formatter) (Resolution, error) {
	var route Route
	if spec.ModelAlias != "" {
		route = formatter.ModelAliasMap[spec.ModelAlias]
	}
	if spec.RoleHint != "" {
		if rule, ok := formatter.RoleHintRules[spec.RoleHint]; ok && rule.PreferredProvider != "" {
			if route.Provider == "" {
				route.Provider = rule.PreferredProvider
			} else if route.Provider != rule.PreferredProvider {
				route.Provider = rule.PreferredProvider
				if !formatter.supportsModel(route.Provider, route.Model) {
					if models := formatter.ProviderModels[route.Provider]; len(models) > 0 {
						route.Model = models[0]
					} else {
						route.Model = formatter.Fallback.Model
					}
				}
			}
		}
	}
	if route.Provider == "" || route.Model == "" {
		route = formatter.Fallback
	}
	if route.Provider == "" || route.Model == "" {
		return Resolution{}, errors.New("unable to resolve provider/model")
	}

	resolution := Resolution{
		Provider:   route.Provider,
		Model:      route.Model,
		LaunchArgs: append([]string(nil), formatter.ProviderDefaults[route.Provider].LaunchArgs...),
	}
	if spec.ReasoningEffort != "" {
		resolution.ReasoningEffort = formatter.EffortMap[route.Provider][spec.ReasoningEffort]
	}
	return resolution, nil
}

func (f Formatter) supportsModel(providerName, model string) bool {
	if providerName == "" || model == "" {
		return false
	}
	models := f.ProviderModels[providerName]
	if len(models) == 0 {
		return true
	}
	for _, candidate := range models {
		if candidate == model {
			return true
		}
	}
	return false
}

func BuildPrompt(spec AgentSpec, input string) (string, error) {
	sections := []string{}
	if spec.PromptSeedFile != "" {
		seedPath := spec.PromptSeedFile
		if !filepath.IsAbs(seedPath) {
			if cwd, err := os.Getwd(); err == nil {
				seedPath = filepath.Join(cwd, seedPath)
			}
		}
		data, err := os.ReadFile(seedPath)
		if err != nil {
			return "", fmt.Errorf("read promptSeedFile: %w", err)
		}
		sections = append(sections, strings.TrimSpace(string(data)))
	}
	if spec.Body != "" {
		sections = append(sections, spec.Body)
	}
	if input != "" {
		sections = append(sections, strings.TrimSpace(input))
	}
	return strings.TrimSpace(strings.Join(sections, "\n\n")), nil
}

func splitFrontmatter(content string) (frontmatter, body string, hasFrontmatter bool, err error) {
	if !strings.HasPrefix(content, "---\n") {
		return "", content, false, nil
	}
	rest := content[len("---\n"):]
	idx := strings.Index(rest, "\n---\n")
	if idx < 0 {
		return "", "", false, errors.New("parse frontmatter: missing closing delimiter")
	}
	return rest[:idx], rest[idx+len("\n---\n"):], true, nil
}
