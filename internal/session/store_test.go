package session_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/session"
)

func TestCreate(t *testing.T) {
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	rec, err := s.Create("gemini", "review", "default")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if rec.ID == "" {
		t.Error("expected non-empty ID")
	}
	if rec.Provider != "gemini" {
		t.Errorf("provider: got %q, want %q", rec.Provider, "gemini")
	}
	if rec.Command != "review" {
		t.Errorf("command: got %q, want %q", rec.Command, "review")
	}
	if rec.Status != session.StatusRunning {
		t.Errorf("status: got %q, want %q", rec.Status, session.StatusRunning)
	}
	if rec.PID != nil {
		t.Error("PID must be nil at creation time (set via SetPID before streaming)")
	}
	if rec.ExitCode != nil {
		t.Error("ExitCode must be nil for running session")
	}
	if rec.EndedAt != nil {
		t.Error("EndedAt must be nil for running session")
	}
}

func TestSetPIDBeforeFirstOutput(t *testing.T) {
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	rec, err := s.Create("gemini", "review", "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// PID must be settable and visible before streaming starts (R-RUN-03)
	if err := s.SetPID(rec.ID, 12345); err != nil {
		t.Fatalf("SetPID: %v", err)
	}

	got, err := s.Read(rec.ID)
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if got.PID == nil {
		t.Fatal("PID must be set after SetPID")
	}
	if *got.PID != 12345 {
		t.Errorf("PID: got %d, want 12345", *got.PID)
	}
}

func TestMarkDone(t *testing.T) {
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	rec, _ := s.Create("gemini", "review", "")
	_ = s.SetPID(rec.ID, 99)

	if err := s.MarkDone(rec.ID); err != nil {
		t.Fatalf("MarkDone: %v", err)
	}

	got, _ := s.Read(rec.ID)
	if got.Status != session.StatusDone {
		t.Errorf("status: got %q, want %q", got.Status, session.StatusDone)
	}
	// R-EXIT-02: exitCode: 0 for done sessions
	if got.ExitCode == nil {
		t.Fatal("ExitCode must be set for done session")
	}
	if *got.ExitCode != 0 {
		t.Errorf("ExitCode: got %d, want 0", *got.ExitCode)
	}
	if got.Signal != nil {
		t.Error("Signal must be nil for done session")
	}
	if got.EndedAt == nil {
		t.Error("EndedAt must be set for done session")
	}
}

func TestMarkFailed(t *testing.T) {
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	rec, _ := s.Create("gemini", "review", "")
	if err := s.MarkFailed(rec.ID, 1); err != nil {
		t.Fatalf("MarkFailed: %v", err)
	}

	got, _ := s.Read(rec.ID)
	if got.Status != session.StatusFailed {
		t.Errorf("status: got %q, want %q", got.Status, session.StatusFailed)
	}
	// R-EXIT-01: exactly one of exitCode or signal for failed sessions
	if got.ExitCode == nil {
		t.Fatal("ExitCode must be set for failed session")
	}
	if *got.ExitCode != 1 {
		t.Errorf("ExitCode: got %d, want 1", *got.ExitCode)
	}
	if got.Signal != nil {
		t.Error("Signal must not be set when ExitCode is set")
	}
}

func TestMarkFailedWithSignal(t *testing.T) {
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	rec, _ := s.Create("gemini", "review", "")

	// timeout signal (R-EXIT-03)
	if err := s.MarkFailedWithSignal(rec.ID, "timeout"); err != nil {
		t.Fatalf("MarkFailedWithSignal: %v", err)
	}

	got, _ := s.Read(rec.ID)
	if got.Status != session.StatusFailed {
		t.Errorf("status: got %q, want %q", got.Status, session.StatusFailed)
	}
	if got.Signal == nil {
		t.Fatal("Signal must be set")
	}
	if *got.Signal != "timeout" {
		t.Errorf("Signal: got %q, want %q", *got.Signal, "timeout")
	}
	// R-EXIT-01: must not also have exitCode
	if got.ExitCode != nil {
		t.Error("ExitCode must not be set when Signal is set")
	}
}

func TestMarkCancelled(t *testing.T) {
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	rec, _ := s.Create("gemini", "review", "")
	_ = s.SetPID(rec.ID, 500)

	if err := s.MarkCancelled(rec.ID); err != nil {
		t.Fatalf("MarkCancelled: %v", err)
	}

	got, _ := s.Read(rec.ID)
	if got.Status != session.StatusCancelled {
		t.Errorf("status: got %q, want %q", got.Status, session.StatusCancelled)
	}
	if got.EndedAt == nil {
		t.Error("EndedAt must be set for cancelled session")
	}
}

func TestLatestPointerFile(t *testing.T) {
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	// No sessions: LatestID returns ""
	id, err := s.LatestID()
	if err != nil {
		t.Fatalf("LatestID (empty): %v", err)
	}
	if id != "" {
		t.Errorf("LatestID (empty): got %q, want empty", id)
	}

	// Create first session
	rec1, _ := s.Create("gemini", "review", "")
	id1 := rec1.ID

	// LatestID must return first session
	got, _ := s.LatestID()
	if got != id1 {
		t.Errorf("after first session: got %q, want %q", got, id1)
	}

	// Create second session
	time.Sleep(5 * time.Millisecond)
	rec2, _ := s.Create("copilot", "review", "")
	id2 := rec2.ID

	// LatestID must return second session (most recently created)
	got, _ = s.LatestID()
	if got != id2 {
		t.Errorf("after second session: got %q, want %q", got, id2)
	}

	// Verify latest pointer file exists and contains the UUID directly
	latestPath := filepath.Join(dir, "latest")
	data, err := os.ReadFile(latestPath)
	if err != nil {
		t.Fatalf("latest pointer file: %v", err)
	}
	if string(data) != id2 {
		t.Errorf("latest pointer file content: got %q, want %q", string(data), id2)
	}
}

func TestACOSessionDirEnvVar(t *testing.T) {
	// R-PERSIST-06: ACO_SESSION_DIR override for test isolation
	dir := t.TempDir()
	t.Setenv("ACO_SESSION_DIR", dir)

	s := session.NewStore()
	if s == nil {
		t.Fatal("NewStore returned nil")
	}

	rec, err := s.Create("gemini", "review", "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Session must be created under the overridden directory
	taskPath := filepath.Join(dir, rec.ID, "task.json")
	if _, err := os.Stat(taskPath); err != nil {
		t.Errorf("task.json not in ACO_SESSION_DIR: %v", err)
	}
}

func TestAtomicWrite(t *testing.T) {
	// Verifies that task.json is never partially written (R-PERSIST-01, R-PERSIST-04).
	// Concurrently patch the same session from multiple goroutines and verify
	// the final state is always valid JSON.
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	rec, _ := s.Create("gemini", "review", "")

	done := make(chan error, 10)
	for i := 0; i < 10; i++ {
		pid := i + 1
		go func(p int) {
			done <- s.SetPID(rec.ID, p)
		}(pid)
	}

	for i := 0; i < 10; i++ {
		if err := <-done; err != nil {
			t.Errorf("concurrent SetPID: %v", err)
		}
	}

	// Final task.json must be valid and parseable
	got, err := s.Read(rec.ID)
	if err != nil {
		t.Fatalf("Read after concurrent writes: %v", err)
	}
	if got.PID == nil {
		t.Error("PID must be set after concurrent writes")
	}
}

func TestSessionFilePermissions(t *testing.T) {
	dir := t.TempDir()
	s := session.NewStoreAt(dir)

	rec, _ := s.Create("gemini", "review", "")

	// Session directory: 0700 (R-PERSIST-02)
	sessionDir := filepath.Join(dir, rec.ID)
	info, err := os.Stat(sessionDir)
	if err != nil {
		t.Fatalf("stat session dir: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0o700 {
		t.Errorf("session dir perm: got %o, want %o", perm, 0o700)
	}

	// task.json: 0600 (R-PERSIST-03)
	taskPath := filepath.Join(sessionDir, "task.json")
	info, err = os.Stat(taskPath)
	if err != nil {
		t.Fatalf("stat task.json: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Errorf("task.json perm: got %o, want %o", perm, 0o600)
	}
}

func TestIsTerminal(t *testing.T) {
	cases := []struct {
		status   session.SessionStatus
		terminal bool
	}{
		{session.StatusRunning, false},
		{session.StatusDone, true},
		{session.StatusFailed, true},
		{session.StatusCancelled, true},
	}
	for _, c := range cases {
		if got := c.status.IsTerminal(); got != c.terminal {
			t.Errorf("%q.IsTerminal() = %v, want %v", c.status, got, c.terminal)
		}
	}
}
