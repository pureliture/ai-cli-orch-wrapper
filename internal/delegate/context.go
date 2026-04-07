package delegate

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

func BuildMarshaledPrompt(task, branch, diff string, maxBytes int) string {
	if maxBytes > 0 && len(diff) > maxBytes {
		// Walk back from maxBytes to find a valid UTF-8 rune boundary so we
		// don't split a multi-byte sequence (e.g. Korean, emoji, smart quotes).
		truncAt := maxBytes
		for truncAt > 0 && !utf8.RuneStart(diff[truncAt]) {
			truncAt--
		}
		diff = diff[:truncAt] + "\n[truncated]"
	}
	diff = strings.TrimRight(diff, "\n")
	return fmt.Sprintf("## Task\n%s\n\n## Branch\n%s\n\n## Changes\n```diff\n%s\n```", task, branch, diff)
}
