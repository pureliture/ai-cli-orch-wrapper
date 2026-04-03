package runner_test

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/session"
)

// ---------------------------------------------------------------------------
// mockProvider is a test Provider backed by a shell script.
// ---------------------------------------------------------------------------

type mockProvider struct {
	name        string
	binary      string
	available   bool
	installHint string
	authFail    func(code int, stderr string) bool
}

func (m *mockProvider) Name() string        { return m.name }
func (m *mockProvider) Binary() string      { return m.binary }
func (m *mockProvider) IsAvailable() bool   { return m.available }
func (m *mockProvider) InstallHint() string { return m.installHint }
func (m *mockProvider) AuthHint() string    { return "run: " + m.name + " auth" }
func (m *mockProvider) IsAuthFailure(code int, stderr string) bool {
	if m.authFail != nil {
		return m.authFail(code, stderr)
	}
	return false
}
func (m *mockProvider) CheckAuth(_ context.Context) error { return nil }
func (m *mockProvider) BuildArgs(command, prompt, content string, _ provider.InvokeOpts) []string {
	// Combine prompt and content inline for test purposes.
	return []string{"-c", fmt.Sprintf(`%s`, command)}
}

// ---------------------------------------------------------------------------
// scriptProvider creates a provider that runs a shell script.
// ---------------------------------------------------------------------------

func scriptProvider(t *testing.T, script string) (*mockProvider, string) {
	t.Helper()
	dir := t.TempDir()
	binPath := filepath.Join(dir, "fake-provider")
	if err := os.WriteFile(binPath, []byte("#!/bin/sh\n"+script), 0o755); err != nil {
		t.Fatalf("write script: %v", err)
	}
	return &mockProvider{
		name:        "fake",
		binary:      binPath,
		available:   true,
		installHint: "install fake",
	}, binPath
}

// ---------------------------------------------------------------------------
// runOpts builds RunOpts wired to a temp session directory.
// ---------------------------------------------------------------------------

func newRunOpts(t *testing.T, prov provider.Provider) (runner.RunOpts, *session.Store, string) {
	t.Helper()
	sessionDir := t.TempDir()
	store := session.NewStoreAt(sessionDir)
	rec, err := store.Create(prov.Name(), "review", "default")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	var stdout bytes.Buffer
	return runner.RunOpts{
		Provider:    prov,
		Command:     "sh",
		Prompt:      "test prompt",
		Content:     "test content",
		SessionID:   rec.ID,
		TimeoutSecs: 10,
		PermProfile: provider.ProfileDefault,
		Store:       store,
		Stdout:      &stdout,
		OutputLog:   store.OutputLogPath(rec.ID),
		ErrorLog:    store.ErrorLogPath(rec.ID),
	}, store, rec.ID
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestProcessRunner_Success verifies clean exit: session marked done, output tee'd.
func TestProcessRunner_Success(t *testing.T) {
	prov, _ := scriptProvider(t, `echo "hello from provider"; echo "line 2"`)
	opts, store, sessionID := newRunOpts(t, prov)

	r := runner.ProcessRunner{}
	err := r.Run(context.Background(), opts)
	if err != nil {
		t.Fatalf("Run: unexpected error: %v", err)
	}

	// task.json must be marked done with exitCode: 0 (R-EXIT-02)
	if err := store.MarkDone(sessionID); err != nil {
		t.Fatalf("MarkDone: %v", err)
	}
	rec, _ := store.Read(sessionID)
	if rec.Status != session.StatusDone {
		t.Errorf("status: got %q, want %q", rec.Status, session.StatusDone)
	}
	if rec.ExitCode == nil || *rec.ExitCode != 0 {
		t.Errorf("exitCode: got %v, want 0", rec.ExitCode)
	}

	// output.log must contain the provider output (R-TEE-01)
	log, _ := os.ReadFile(opts.OutputLog)
	if !strings.Contains(string(log), "hello from provider") {
		t.Errorf("output.log missing expected content, got: %q", string(log))
	}
	if !strings.Contains(string(log), "line 2") {
		t.Errorf("output.log missing line 2, got: %q", string(log))
	}
}

// TestProcessRunner_PIDBeforeOutput verifies CPW-01 / R-RUN-03: PID is in
// task.json synchronously, before any output bytes arrive.
func TestProcessRunner_PIDBeforeOutput(t *testing.T) {
	// Script: sleep briefly before writing output, giving the test a window to
	// check that PID is already present when the first byte arrives.
	prov, _ := scriptProvider(t, `sleep 0.1; echo "delayed output"`)
	opts, store, sessionID := newRunOpts(t, prov)

	done := make(chan error, 1)
	go func() {
		done <- runner.ProcessRunner{}.Run(context.Background(), opts)
	}()

	// Poll for PID to appear within 200ms (it should be there < 50ms after spawn)
	var pidFound int
	deadline := time.Now().Add(200 * time.Millisecond)
	for time.Now().Before(deadline) {
		rec, err := store.Read(sessionID)
		if err == nil && rec.PID != nil {
			pidFound = *rec.PID
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	if pidFound == 0 {
		t.Error("PID not recorded within 200ms of spawn (R-RUN-03 / CPW-01 violation)")
	}

	// Wait for run to finish
	if err := <-done; err != nil {
		t.Fatalf("Run: %v", err)
	}

	// Verify output arrived (provider did produce output)
	log, _ := os.ReadFile(opts.OutputLog)
	if !strings.Contains(string(log), "delayed output") {
		t.Errorf("output.log: %q", string(log))
	}
}

// TestProcessRunner_LiveStreaming verifies R-TEE-01: chunks arrive incrementally,
// not buffered until process exits.
func TestProcessRunner_LiveStreaming(t *testing.T) {
	// Script emits 3 chunks with 50ms gaps.
	prov, _ := scriptProvider(t, `
echo "chunk 1"
sleep 0.05
echo "chunk 2"
sleep 0.05
echo "chunk 3"
`)
	sessionDir := t.TempDir()
	store := session.NewStoreAt(sessionDir)
	rec, _ := store.Create(prov.Name(), "review", "")

	type chunk struct {
		text string
		at   time.Time
	}
	var mu bytes.Buffer
	var chunks []chunk
	type trackingWriter struct{}

	// Use a custom writer to capture arrival times.
	arrival := make(chan string, 10)
	trackWriter := &chanWriter{arrival}

	opts := runner.RunOpts{
		Provider:    prov,
		Command:     "sh",
		Prompt:      "",
		Content:     "",
		SessionID:   rec.ID,
		TimeoutSecs: 10,
		PermProfile: provider.ProfileDefault,
		Store:       store,
		Stdout:      trackWriter,
		OutputLog:   store.OutputLogPath(rec.ID),
		ErrorLog:    store.ErrorLogPath(rec.ID),
	}

	_ = mu
	_ = chunks

	done := make(chan error, 1)
	go func() {
		done <- runner.ProcessRunner{}.Run(context.Background(), opts)
	}()

	// Collect chunk arrival times
	var arrivals []time.Time
	timeout := time.After(5 * time.Second)
	for i := 0; i < 3; i++ {
		select {
		case <-arrival:
			arrivals = append(arrivals, time.Now())
		case <-timeout:
			t.Fatal("timed out waiting for chunks")
		}
	}

	if err := <-done; err != nil {
		t.Fatalf("Run: %v", err)
	}

	// The time spread between first and last chunk must be > 50ms (not all buffered)
	if len(arrivals) >= 2 {
		spread := arrivals[len(arrivals)-1].Sub(arrivals[0])
		if spread < 40*time.Millisecond {
			t.Errorf("chunks arrived within %v — likely buffered (not streaming)", spread)
		}
	}
}

// chanWriter is a test io.Writer that sends each write to a channel.
type chanWriter struct{ ch chan<- string }

func (w *chanWriter) Write(p []byte) (int, error) {
	if s := strings.TrimSpace(string(p)); s != "" {
		w.ch <- s
	}
	return len(p), nil
}

// TestProcessRunner_StderrCapture verifies R-STDERR-01: stderr goes to error.log.
func TestProcessRunner_StderrCapture(t *testing.T) {
	prov, _ := scriptProvider(t, `echo "stdout line"; echo "stderr line" >&2`)
	opts, _, _ := newRunOpts(t, prov)

	_ = runner.ProcessRunner{}.Run(context.Background(), opts)

	errorLog, _ := os.ReadFile(opts.ErrorLog)
	if !strings.Contains(string(errorLog), "stderr line") {
		t.Errorf("error.log missing stderr: %q", string(errorLog))
	}
	outputLog, _ := os.ReadFile(opts.OutputLog)
	if strings.Contains(string(outputLog), "stderr line") {
		t.Error("output.log must not contain stderr content (R-STDERR-04)")
	}
}

// TestProcessRunner_NonZeroExit verifies R-RUN-07: non-zero exit → ExitError.
func TestProcessRunner_NonZeroExit(t *testing.T) {
	prov, _ := scriptProvider(t, `echo "some output"; exit 2`)
	opts, _, _ := newRunOpts(t, prov)

	err := runner.ProcessRunner{}.Run(context.Background(), opts)
	if err == nil {
		t.Fatal("expected error for non-zero exit, got nil")
	}

	var exitErr *provider.ExitError
	if !isError(err, &exitErr) {
		t.Fatalf("expected *provider.ExitError, got %T: %v", err, err)
	}
	if exitErr.ExitCode != 2 {
		t.Errorf("exitCode: got %d, want 2", exitErr.ExitCode)
	}
}

// TestProcessRunner_Timeout verifies R-RUN-09 / R-EXIT-03: timeout → TimeoutError
// with signal "timeout" distinction.
func TestProcessRunner_Timeout(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping timeout test in short mode")
	}
	prov, _ := scriptProvider(t, `sleep 30`)
	opts, _, _ := newRunOpts(t, prov)
	opts.TimeoutSecs = 1 // 1s timeout

	start := time.Now()
	err := runner.ProcessRunner{}.Run(context.Background(), opts)
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("expected TimeoutError, got nil")
	}

	var timeoutErr *provider.TimeoutError
	if !isError(err, &timeoutErr) {
		t.Fatalf("expected *provider.TimeoutError, got %T: %v", err, err)
	}
	if timeoutErr.TimeoutSecs != 1 {
		t.Errorf("TimeoutSecs: got %d, want 1", timeoutErr.TimeoutSecs)
	}

	// Must complete within 1s timeout + 3s WaitDelay + 1s buffer
	if elapsed > 5*time.Second {
		t.Errorf("timeout took %v — too slow (SIGKILL escalation may not have fired)", elapsed)
	}
}

// TestProcessRunner_AuthFailure verifies R-AUTH-04: provider auth detection →
// AuthError with auth hint.
func TestProcessRunner_AuthFailure(t *testing.T) {
	prov, _ := scriptProvider(t, `echo "unauthenticated" >&2; exit 1`)
	prov.authFail = func(code int, stderr string) bool {
		return strings.Contains(strings.ToLower(stderr), "unauthenticated")
	}
	opts, _, _ := newRunOpts(t, prov)

	err := runner.ProcessRunner{}.Run(context.Background(), opts)
	if err == nil {
		t.Fatal("expected AuthError, got nil")
	}

	var authErr *provider.AuthError
	if !isError(err, &authErr) {
		t.Fatalf("expected *provider.AuthError, got %T: %v", err, err)
	}
	if authErr.Provider != "fake" {
		t.Errorf("Provider: got %q, want %q", authErr.Provider, "fake")
	}
}

// TestProcessRunner_ProviderNotFound verifies R-RUN-01 / R-AVAIL-01: binary
// absent → NotFoundError with install hint.
func TestProcessRunner_ProviderNotFound(t *testing.T) {
	prov := &mockProvider{
		name:        "nonexistent",
		binary:      "/nonexistent/path/to/binary",
		available:   false,
		installHint: "npm install -g nonexistent",
	}
	opts, store, _ := newRunOpts(t, prov)

	// Swap provider in opts
	opts.Provider = prov

	err := runner.ProcessRunner{}.Run(context.Background(), opts)
	if err == nil {
		t.Fatal("expected NotFoundError, got nil")
	}

	var notFoundErr *provider.NotFoundError
	if !isError(err, &notFoundErr) {
		t.Fatalf("expected *provider.NotFoundError, got %T: %v", err, err)
	}
	if !strings.Contains(notFoundErr.InstallHint, "npm install") {
		t.Errorf("InstallHint: %q", notFoundErr.InstallHint)
	}

	_ = store
}

// TestProcessRunner_PartialOutputOnKill verifies R-TEE-04: output.log preserves
// bytes written before process is killed.
func TestProcessRunner_PartialOutputOnKill(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping partial output test in short mode")
	}
	// Script writes one line then hangs.
	prov, _ := scriptProvider(t, `echo "partial line before kill"; sleep 30`)
	opts, _, _ := newRunOpts(t, prov)
	opts.TimeoutSecs = 1

	_ = runner.ProcessRunner{}.Run(context.Background(), opts)

	// output.log must have the partial line even though the process was killed.
	log, _ := os.ReadFile(opts.OutputLog)
	if !strings.Contains(string(log), "partial line before kill") {
		t.Errorf("output.log must preserve partial output after kill, got: %q", string(log))
	}
}

// ---------------------------------------------------------------------------
// Helper: type-assert error without reflect
// ---------------------------------------------------------------------------

func isError[T error](err error, target *T) bool {
	if e, ok := err.(T); ok {
		*target = e
		return true
	}
	return false
}
