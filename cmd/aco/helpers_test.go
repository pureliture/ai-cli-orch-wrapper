// Package main contains shared test helpers for cmd/aco command tests.
package main

import (
	"testing"

	"github.com/pureliture/ai-cli-orch-wrapper/internal/provider"
	"github.com/pureliture/ai-cli-orch-wrapper/internal/runner"
)

// newTestDeps creates a deps struct suitable for unit testing cmd handlers.
func newTestDeps(t *testing.T) *deps {
	t.Helper()
	return &deps{
		registry: provider.NewRegistry(),
		runner:   runner.StubRunner{},
	}
}
