package delegate

import (
	"fmt"
	"strings"
)

func BuildMarshaledPrompt(task, branch, diff string, maxBytes int) string {
	if maxBytes > 0 && len(diff) > maxBytes {
		diff = diff[:maxBytes] + "\n[truncated]"
	}
	diff = strings.TrimRight(diff, "\n")
	return fmt.Sprintf("## Task\n%s\n\n## Branch\n%s\n\n## Changes\n```diff\n%s\n```", task, branch, diff)
}
