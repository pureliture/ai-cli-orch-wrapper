// Package main contains shared test helpers for cmd/aco command tests.
// These helpers are intended for use by future cmd tests in this package.
package main

import (
	"testing"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/session"
)

// newTestDeps creates a deps struct suitable for unit testing cmd handlers.
// It uses an isolated session store in t.TempDir(), an empty provider registry,
// and a StubRunner. The temporary directory is automatically cleaned up by
// the testing framework when the test completes.
func newTestDeps(t *testing.T) *deps {
	t.Helper()
	return &deps{
		store:    session.NewStoreAt(t.TempDir()),
		registry: provider.NewRegistry(),
		runner:   runner.StubRunner{},
	}
}
