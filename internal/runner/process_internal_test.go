package runner

import (
	"strings"
	"testing"
)

func TestTailBuffer_KeepLastBytes(t *testing.T) {
	buf := newTailBuffer(8)
	_, _ = buf.Write([]byte("abcdef"))
	_, _ = buf.Write([]byte("ghijkl"))

	if got, want := buf.String(), "efghijkl"; got != want {
		t.Fatalf("String() = %q, want %q", got, want)
	}
}

func TestTailBuffer_DropsOversizedWritePrefix(t *testing.T) {
	buf := newTailBuffer(16)
	_, _ = buf.Write([]byte(strings.Repeat("x", 32) + "TAIL"))

	if got := buf.String(); got != strings.Repeat("x", 12)+"TAIL" {
		t.Fatalf("String() = %q, want suffix-preserving tail", got)
	}
}
