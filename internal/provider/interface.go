package provider

import "context"

// PermissionProfile controls which tools a provider is allowed to use.
type PermissionProfile string

const (
	ProfileDefault      PermissionProfile = "default"
	ProfileRestricted   PermissionProfile = "restricted"
	ProfileUnrestricted PermissionProfile = "unrestricted"
)

// InvokeOpts contains per-invocation options for provider.BuildArgs.
// PID recording is the runner's responsibility (R-RUN-03, CPW-01),
// not the provider's — the runner calls store.SetPID directly after cmd.Start().
// OnPID was removed to avoid misleading Phase 2 implementers into routing
// PID recording through the provider interface.
type InvokeOpts struct {
	PermissionProfile PermissionProfile
	SessionID         string
	TimeoutSecs       int
	Model             string
	ReasoningEffort   string
	ExtraArgs         []string
}

// Provider defines the per-provider implementation contract.
//
// Implementations must:
//   - Locate the provider binary via PATH (R-SPAWN-01)
//   - Return the install hint when IsAvailable() is false (R-AVAIL-01)
//   - Classify auth failures via IsAuthFailure (R-AUTH-04)
//
// Phase 1: Implementations are stubs. Phase 4 adds Gemini and Copilot providers.
type Provider interface {
	// Name returns the canonical provider key (e.g., "gemini", "copilot").
	Name() string

	// Binary returns the executable name to locate via PATH.
	Binary() string

	// IsAvailable reports whether the provider binary is present in PATH.
	IsAvailable() bool

	// InstallHint returns human-readable instructions to install the provider.
	InstallHint() string

	// BuildArgs constructs the command-line arguments for the provider invocation.
	// The prompt and content are combined into arguments per provider conventions.
	BuildArgs(command, prompt, content string, opts InvokeOpts) []string

	// IsAuthFailure reports whether the given exit code and stderr output
	// indicate an authentication failure (R-AUTH-04).
	// Used by the runner to classify errors at the provider boundary.
	IsAuthFailure(exitCode int, stderr string) bool

	// AuthHint returns the instruction to fix authentication for this provider.
	AuthHint() string

	// CheckAuth performs a lightweight auth check (e.g., --version invocation).
	// Returns nil if auth appears valid, AuthError otherwise.
	// Called by aco-install provider setup, NOT by aco run (R-AUTH-03).
	CheckAuth(ctx context.Context) error
}
