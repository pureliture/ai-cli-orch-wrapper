// Package result_test contains table-driven tests for the result renderer.
//
// Contract coverage: R-STATUS-02, R-STATUS-04, R-STATUS-05,
//
//	R-RESULT-02..05, R-EXIT-01..03
package result_test

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/result"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/session"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func intPtr(v int) *int       { return &v }
func strPtr(s string) *string { return &s }
func timePtr(t time.Time) *time.Time { return &t }

// baseRecord returns a minimal running TaskRecord for use as a test baseline.
func baseRecord() *session.TaskRecord {
	return &session.TaskRecord{
		ID:        "test-session-id",
		Provider:  "gemini",
		Command:   "review",
		Status:    session.StatusRunning,
		StartedAt: time.Date(2026, 4, 3, 12, 0, 0, 0, time.UTC),
	}
}

// writeFile creates a file at path with the given content for use in result tests.
func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatalf("writeFile: mkdir: %v", err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("writeFile: write: %v", err)
	}
}

// ---------------------------------------------------------------------------
// ExitCode tests
// ---------------------------------------------------------------------------

func TestExitCode(t *testing.T) {
	cases := []struct {
		status session.SessionStatus
		want   int
	}{
		{session.StatusRunning, 3},
		{session.StatusDone, 0},
		{session.StatusFailed, 1},
		{session.StatusCancelled, 2},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(string(tc.status), func(t *testing.T) {
			got := result.ExitCode(tc.status)
			if got != tc.want {
				t.Errorf("ExitCode(%q) = %d, want %d", tc.status, got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// RenderStatus tests
// ---------------------------------------------------------------------------

func TestRenderStatus(t *testing.T) {
	ended := time.Date(2026, 4, 3, 13, 0, 0, 0, time.UTC)

	cases := []struct {
		name     string
		rec      *session.TaskRecord
		contains []string
		absent   []string
		wantCode int
	}{
		{
			name: "running with PID",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.PID = intPtr(12345)
				return r
			}(),
			contains: []string{"Status:     running", "PID:        12345"},
			absent:   []string{"ExitCode:", "Signal:"},
			wantCode: 3,
		},
		{
			name: "running without PID",
			rec:  baseRecord(),
			absent: []string{"PID:", "ExitCode:", "Signal:"},
			contains: []string{"Status:     running"},
			wantCode: 3,
		},
		{
			name: "done",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusDone
				r.EndedAt = timePtr(ended)
				r.ExitCode = intPtr(0)
				return r
			}(),
			contains: []string{"Status:     done", "ExitCode:   0"},
			absent:   []string{"Signal:"},
			wantCode: 0,
		},
		{
			name: "failed with exit code",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusFailed
				r.EndedAt = timePtr(ended)
				r.ExitCode = intPtr(2)
				return r
			}(),
			contains: []string{"Status:     failed", "ExitCode:   2"},
			absent:   []string{"Signal:"},
			wantCode: 1,
		},
		{
			name: "failed with signal",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusFailed
				r.EndedAt = timePtr(ended)
				r.Signal = strPtr("timeout")
				return r
			}(),
			contains: []string{"Status:     failed", "Signal:     timeout"},
			absent:   []string{"ExitCode:"},
			wantCode: 1,
		},
		{
			// R-STATUS-05 bug fix: cancelled sessions must NOT show "ExitCode: unknown"
			// even though they also have no exitCode and no signal.
			name: "cancelled — no ExitCode unknown line",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusCancelled
				r.EndedAt = timePtr(ended)
				return r
			}(),
			contains: []string{"Status:     cancelled"},
			absent:   []string{"ExitCode:"},
			wantCode: 2,
		},
		{
			// R-STATUS-05 Node compat: failed session with neither exitCode nor signal
			// (created by Node wrapper) must display "ExitCode: unknown".
			name: "failed with no exitCode and no signal — Node compat unknown",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusFailed
				r.EndedAt = timePtr(ended)
				// ExitCode and Signal both nil — Node migration scenario
				return r
			}(),
			contains: []string{"Status:     failed", "ExitCode:   unknown"},
			absent:   []string{"Signal:"},
			wantCode: 1,
		},
		{
			name: "failed with PermissionProfile",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusFailed
				r.EndedAt = timePtr(ended)
				r.ExitCode = intPtr(1)
				r.PermissionProfile = "restricted"
				return r
			}(),
			contains: []string{"Status:     failed", "Permission: restricted"},
			wantCode: 1,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			var buf bytes.Buffer
			code := result.RenderStatus(&buf, tc.rec)
			out := buf.String()

			if code != tc.wantCode {
				t.Errorf("exit code = %d, want %d", code, tc.wantCode)
			}
			for _, s := range tc.contains {
				if !strings.Contains(out, s) {
					t.Errorf("output missing %q\nfull output:\n%s", s, out)
				}
			}
			for _, s := range tc.absent {
				if strings.Contains(out, s) {
					t.Errorf("output should not contain %q\nfull output:\n%s", s, out)
				}
			}
		})
	}
}

// ---------------------------------------------------------------------------
// RenderResult tests
// ---------------------------------------------------------------------------

func TestRenderResult(t *testing.T) {
	cases := []struct {
		name          string
		rec           *session.TaskRecord
		outputContent string // "" means no file written (absent)
		errorContent  string // "" means no file written (absent)
		writeOutput   bool
		writeError    bool
		contains      []string
		absent        []string
		wantCode      int
	}{
		{
			name: "running — banner + partial output",
			rec:  baseRecord(),
			outputContent: "partial line\n",
			writeOutput: true,
			contains: []string{
				"⟳",
				"still running",
				"partial line",
			},
			wantCode: 3,
		},
		{
			name: "done — full output.log",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusDone
				r.ExitCode = intPtr(0)
				return r
			}(),
			outputContent: "result output\n",
			writeOutput:   true,
			contains:      []string{"result output"},
			wantCode:      0,
		},
		{
			name: "failed — output + error separator",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusFailed
				r.ExitCode = intPtr(1)
				return r
			}(),
			outputContent: "some output\n",
			errorContent:  "error detail\n",
			writeOutput:   true,
			writeError:    true,
			contains:      []string{"some output", "--- error ---", "error detail"},
			wantCode:      1,
		},
		{
			name: "cancelled — banner",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusCancelled
				return r
			}(),
			writeOutput: false,
			contains:    []string{"✗", "cancelled"},
			wantCode:    2,
		},
		{
			name: "done with empty output.log — exit 0 no crash",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusDone
				r.ExitCode = intPtr(0)
				return r
			}(),
			outputContent: "",
			writeOutput:   true,
			// empty output is fine — just verify no crash and correct code
			wantCode: 0,
		},
		{
			name: "failed with missing error.log — only shows output",
			rec: func() *session.TaskRecord {
				r := baseRecord()
				r.Status = session.StatusFailed
				r.ExitCode = intPtr(1)
				return r
			}(),
			outputContent: "output only\n",
			writeOutput:   true,
			writeError:    false, // error.log intentionally absent
			contains:      []string{"output only"},
			absent:        []string{"--- error ---"},
			wantCode:      1,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			outputLogPath := filepath.Join(dir, "output.log")
			errorLogPath := filepath.Join(dir, "error.log")

			if tc.writeOutput {
				writeFile(t, outputLogPath, tc.outputContent)
			}
			if tc.writeError {
				writeFile(t, errorLogPath, tc.errorContent)
			}

			var buf bytes.Buffer
			code := result.RenderResult(&buf, tc.rec, outputLogPath, errorLogPath)
			out := buf.String()

			if code != tc.wantCode {
				t.Errorf("exit code = %d, want %d", code, tc.wantCode)
			}
			for _, s := range tc.contains {
				if !strings.Contains(out, s) {
					t.Errorf("output missing %q\nfull output:\n%s", s, out)
				}
			}
			for _, s := range tc.absent {
				if strings.Contains(out, s) {
					t.Errorf("output should not contain %q\nfull output:\n%s", s, out)
				}
			}
		})
	}
}
