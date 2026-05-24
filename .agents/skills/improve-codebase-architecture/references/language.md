# Architecture Language

Use this vocabulary consistently when reviewing or discussing candidates.

## Terms

- Module: anything with an interface and an implementation, from a function to a package slice.
- Interface: everything callers must know to use a module correctly, including types, invariants, error modes, ordering, config, and performance expectations.
- Implementation: code inside the module.
- Depth: leverage at the interface. A deep module exposes a small interface over substantial behavior. A shallow module exposes an interface nearly as complex as its implementation.
- Seam: where an interface lives; a place behavior can change without editing the caller.
- Adapter: a concrete implementation used at a seam.
- Leverage: capability gained per unit of interface learned.
- Locality: change, bugs, knowledge, and verification concentrated in one place.

## Principles

- Depth belongs to the interface, not line count.
- The interface is the test surface.
- One adapter usually means a hypothetical seam. Two adapters can justify a real seam.
- Use the deletion test: if deleting a module makes complexity vanish, it may be pass-through. If deleting it pushes complexity into many callers, the module has earned its place.

## Repository-Specific Reading

In this repo, candidate naming should follow the product language in public docs: provider, provider registry, command, delegation, session, task preset, artifact, sync source, managed target, manifest, shared skill, custom agent, installer, and runtime context.

Avoid naming candidates around future providers or workflow concepts unless the current code or accepted docs already put those adapters in scope.
