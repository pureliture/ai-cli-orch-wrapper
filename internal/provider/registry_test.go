package provider

import (
	"context"
	"reflect"
	"testing"
)

type registryTestProvider struct{ name string }

func (p registryTestProvider) Name() string                                          { return p.name }
func (p registryTestProvider) Binary() string                                        { return p.name }
func (p registryTestProvider) IsAvailable() bool                                     { return true }
func (p registryTestProvider) InstallHint() string                                   { return "" }
func (p registryTestProvider) BuildArgs(string, string, string, InvokeOpts) []string { return nil }
func (p registryTestProvider) IsAuthFailure(int, string) bool                        { return false }
func (p registryTestProvider) AuthHint() string                                      { return "" }
func (p registryTestProvider) CheckAuth(context.Context) error                       { return nil }

func TestRegistryNames_Sorted(t *testing.T) {
	r := NewRegistry()
	r.Register(registryTestProvider{name: "antigravity"})
	r.Register(registryTestProvider{name: "codex"})

	if got, want := r.Names(), []string{"antigravity", "codex"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("Names() = %v, want %v", got, want)
	}
}
