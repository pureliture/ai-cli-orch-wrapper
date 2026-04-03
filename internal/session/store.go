package session

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

// writeSeq provides a process-unique sequence number for temp file names,
// preventing collisions between concurrent writeAtomic calls.
var writeSeq atomic.Uint64

// sessionDirPerm and sessionFilePerm follow R-PERSIST-02 and R-PERSIST-03.
const (
	sessionDirPerm  fs.FileMode = 0o700
	sessionFilePerm fs.FileMode = 0o600
)

// Store manages the session store directory and provides atomic session
// lifecycle operations.
//
// Contract requirements implemented:
//   - R-PERSIST-01: all task.json writes are atomic (temp+rename)
//   - R-PERSIST-02: session directories use 0700 permissions
//   - R-PERSIST-03: task.json, output.log, error.log use 0600 permissions
//   - R-PERSIST-05: latest pointer file (not directory scanning)
//   - R-PERSIST-06: ACO_SESSION_DIR environment variable override
type Store struct {
	baseDir string
}

// NewStore returns a Store using the configured session base directory.
// If the ACO_SESSION_DIR environment variable is set, that path is used
// (test isolation, R-PERSIST-06). Otherwise defaults to ~/.aco/sessions/.
func NewStore() *Store {
	if dir := os.Getenv("ACO_SESSION_DIR"); dir != "" {
		return &Store{baseDir: dir}
	}
	home, _ := os.UserHomeDir()
	return &Store{baseDir: filepath.Join(home, ".aco", "sessions")}
}

// NewStoreAt returns a Store rooted at the given directory. Used by tests.
func NewStoreAt(dir string) *Store {
	return &Store{baseDir: dir}
}

// Create creates a new session directory and task.json.
// The session is created with status "running". No PID is recorded at creation
// time — the PID must be set via SetPID before streaming begins (R-RUN-03).
func (s *Store) Create(provider, command, permissionProfile string) (*TaskRecord, error) {
	if err := os.MkdirAll(s.baseDir, sessionDirPerm); err != nil {
		return nil, fmt.Errorf("session store: create base dir: %w", err)
	}

	id, err := newUUID()
	if err != nil {
		return nil, fmt.Errorf("session store: generate id: %w", err)
	}
	sessionDir := s.sessionDir(id)
	if err := os.Mkdir(sessionDir, sessionDirPerm); err != nil {
		return nil, fmt.Errorf("session store: create session dir: %w", err)
	}

	rec := &TaskRecord{
		ID:        id,
		Provider:  provider,
		Command:   command,
		Status:    StatusRunning,
		StartedAt: time.Now().UTC(),
	}
	if permissionProfile != "" {
		rec.PermissionProfile = permissionProfile
	}

	if err := s.writeAtomic(s.taskPath(id), rec); err != nil {
		return nil, fmt.Errorf("session store: write task.json: %w", err)
	}

	if err := s.updateLatest(id); err != nil {
		// Non-fatal: latest pointer failure does not prevent the session from working.
		// The caller can still address the session by ID.
		_ = err
	}

	return rec, nil
}

// SetPID records the provider process PID in task.json.
// This MUST be called synchronously before streaming begins (R-RUN-03, CPW-01).
func (s *Store) SetPID(id string, pid int) error {
	return s.patch(id, func(rec *TaskRecord) {
		rec.PID = intPtr(pid)
	})
}

// MarkDone marks the session as done with exit code 0 (R-EXIT-02).
func (s *Store) MarkDone(id string) error {
	return s.patch(id, func(rec *TaskRecord) {
		rec.Status = StatusDone
		rec.EndedAt = timePtr(time.Now().UTC())
		rec.ExitCode = intPtr(0)
	})
}

// MarkFailed marks the session as failed with a numeric exit code (R-EXIT-01, R-RUN-07).
// Clears any previously set Signal to enforce R-EXIT-01 (exactly one of exitCode or signal).
func (s *Store) MarkFailed(id string, exitCode int) error {
	return s.patch(id, func(rec *TaskRecord) {
		rec.Status = StatusFailed
		rec.EndedAt = timePtr(time.Now().UTC())
		rec.ExitCode = intPtr(exitCode)
		rec.Signal = nil // R-EXIT-01: clear signal when setting exitCode
	})
}

// MarkFailedWithSignal marks the session as failed with a signal name (R-RUN-08).
// Use signal names like "SIGTERM", "SIGKILL", "timeout", "auth-failure".
// Clears any previously set ExitCode to enforce R-EXIT-01 (exactly one of exitCode or signal).
func (s *Store) MarkFailedWithSignal(id, signal string) error {
	return s.patch(id, func(rec *TaskRecord) {
		rec.Status = StatusFailed
		rec.EndedAt = timePtr(time.Now().UTC())
		rec.Signal = strPtr(signal)
		rec.ExitCode = nil // R-EXIT-01: clear exitCode when setting signal
	})
}

// MarkCancelled marks the session as cancelled (R-CANCEL-04).
// If the process exited with a code before cancellation completed, pass the
// exit code; otherwise pass -1 to omit it.
func (s *Store) MarkCancelled(id string) error {
	return s.patch(id, func(rec *TaskRecord) {
		rec.Status = StatusCancelled
		rec.EndedAt = timePtr(time.Now().UTC())
	})
}

// Read reads the task.json for the given session ID.
func (s *Store) Read(id string) (*TaskRecord, error) {
	data, err := os.ReadFile(s.taskPath(id))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("session %q not found", id)
		}
		return nil, fmt.Errorf("session store: read task.json: %w", err)
	}
	var rec TaskRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return nil, fmt.Errorf("session store: parse task.json: %w", err)
	}
	return &rec, nil
}

// LatestID returns the session ID from the latest pointer file (R-LATEST-01).
// Returns ("", nil) if no latest pointer exists.
func (s *Store) LatestID() (string, error) {
	data, err := os.ReadFile(s.latestPath())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}
		return "", fmt.Errorf("session store: read latest pointer: %w", err)
	}
	id := strings.TrimSpace(string(data))
	if id == "" {
		return "", nil
	}
	// Verify the session directory actually exists.
	if _, err := os.Stat(s.sessionDir(id)); err != nil {
		return "", nil
	}
	return id, nil
}

// OutputLogPath returns the path to output.log for the given session.
func (s *Store) OutputLogPath(id string) string {
	return filepath.Join(s.sessionDir(id), "output.log")
}

// ErrorLogPath returns the path to error.log for the given session.
func (s *Store) ErrorLogPath(id string) string {
	return filepath.Join(s.sessionDir(id), "error.log")
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

func (s *Store) sessionDir(id string) string {
	return filepath.Join(s.baseDir, id)
}

func (s *Store) taskPath(id string) string {
	return filepath.Join(s.sessionDir(id), "task.json")
}

func (s *Store) latestPath() string {
	return filepath.Join(s.baseDir, "latest")
}

// patch reads the current task.json, applies fn, and writes the result atomically.
func (s *Store) patch(id string, fn func(*TaskRecord)) error {
	rec, err := s.Read(id)
	if err != nil {
		return err
	}
	fn(rec)
	return s.writeAtomic(s.taskPath(id), rec)
}

// writeAtomic writes v as JSON to path using a temp-file-then-rename pattern.
// This satisfies R-PERSIST-01 and R-PERSIST-04.
func (s *Store) writeAtomic(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("session store: marshal: %w", err)
	}
	// Write to a temporary file in the same directory to ensure rename is atomic
	// (same filesystem). Combine PID with an atomic sequence number to avoid
	// collisions between concurrent goroutines in the same process.
	tmpPath := fmt.Sprintf("%s.tmp.%d.%d", path, os.Getpid(), writeSeq.Add(1))
	if err := os.WriteFile(tmpPath, data, sessionFilePerm); err != nil {
		return fmt.Errorf("session store: write temp: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath) // best-effort cleanup
		return fmt.Errorf("session store: rename: %w", err)
	}
	return nil
}

// newUUID generates a random UUID v4 using crypto/rand.
// No external dependency required.
func newUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	// Set version 4 and variant bits.
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	), nil
}

// updateLatest atomically updates the latest pointer file (R-LATEST-02, R-PERSIST-05).
func (s *Store) updateLatest(id string) error {
	tmpPath := s.latestPath() + ".tmp"
	if err := os.WriteFile(tmpPath, []byte(id), sessionFilePerm); err != nil {
		return fmt.Errorf("session store: write latest tmp: %w", err)
	}
	if err := os.Rename(tmpPath, s.latestPath()); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("session store: rename latest: %w", err)
	}
	return nil
}
