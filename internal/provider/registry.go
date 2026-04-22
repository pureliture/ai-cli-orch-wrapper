package provider

import (
	"fmt"
	"sort"
)

// Registry maps provider keys to Provider implementations.
// Phase 1: registry is empty. Phase 4 registers GeminiProvider.
type Registry struct {
	providers map[string]Provider
}

// NewRegistry returns an empty provider registry.
func NewRegistry() *Registry {
	return &Registry{providers: make(map[string]Provider)}
}

// Register adds a provider to the registry.
// Panics if a provider with the same name is already registered.
func (r *Registry) Register(p Provider) {
	if _, exists := r.providers[p.Name()]; exists {
		panic(fmt.Sprintf("provider registry: duplicate provider %q", p.Name()))
	}
	r.providers[p.Name()] = p
}

// Get returns the provider for the given key, or an error if not found.
func (r *Registry) Get(name string) (Provider, error) {
	p, ok := r.providers[name]
	if !ok {
		return nil, fmt.Errorf("unknown provider %q — valid providers: %v", name, r.Names())
	}
	return p, nil
}

// Names returns the sorted list of registered provider names.
func (r *Registry) Names() []string {
	names := make([]string, 0, len(r.providers))
	for k := range r.providers {
		names = append(names, k)
	}
	sort.Strings(names)
	return names
}
