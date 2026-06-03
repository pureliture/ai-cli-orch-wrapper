package prompt_test

import (
	"strings"
	"testing"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/prompt"
)

// genericFallback is the substring that appears only in the generic fallback
// prompt returned when no embedded default matches the provider+command key.
const genericFallback = "code review assistant delegated from Claude Code"

// TestLoad_AntigravityEmbeddedKeys verifies that the antigravity provider keys
// resolve to dedicated embedded defaults rather than the generic fallback.
// prompt.Load looks up embeddedDefaults via provider+"-"+command, so the
// antigravity provider requires antigravity-* keys.
func TestLoad_AntigravityEmbeddedKeys(t *testing.T) {
	tmp := t.TempDir() // empty cwd: no local override, forces embedded lookup
	// HOME를 격리해 ~/.claude/aco/prompts/ 에 설치된 파일이 임베디드 기본값을 오버라이드하는
	// 환경 의존 문제를 방지한다. t.Setenv는 테스트 종료 시 자동 복원된다.
	t.Setenv("HOME", tmp)
	t.Setenv("USERPROFILE", tmp)

	cases := []struct {
		command     string
		wantContent string
	}{
		{"review", "senior code reviewer"},
		{"adversarial", "adversarial code reviewer"},
		{"rescue", "debugging specialist"},
	}

	for _, tc := range cases {
		t.Run(tc.command, func(t *testing.T) {
			got, err := prompt.Load(tmp, "antigravity", tc.command)
			if err != nil {
				t.Fatalf("Load(antigravity, %q) error = %v", tc.command, err)
			}
			if strings.Contains(got, genericFallback) {
				t.Fatalf("Load(antigravity, %q) returned generic fallback, want dedicated embedded default", tc.command)
			}
			if !strings.Contains(got, tc.wantContent) {
				t.Fatalf("Load(antigravity, %q) = %q, want it to contain %q", tc.command, got, tc.wantContent)
			}
		})
	}
}

// TestLoad_GeminiKeysRemoved verifies the old gemini-* embedded keys no longer
// exist: the gemini provider now falls through to the generic fallback.
func TestLoad_GeminiKeysRemoved(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("HOME", tmp)
	t.Setenv("USERPROFILE", tmp)

	for _, command := range []string{"review", "adversarial", "rescue"} {
		t.Run(command, func(t *testing.T) {
			got, err := prompt.Load(tmp, "gemini", command)
			if err != nil {
				t.Fatalf("Load(gemini, %q) error = %v", command, err)
			}
			if !strings.Contains(got, genericFallback) {
				t.Fatalf("Load(gemini, %q) = %q, want generic fallback (gemini-* keys removed)", command, got)
			}
		})
	}
}
