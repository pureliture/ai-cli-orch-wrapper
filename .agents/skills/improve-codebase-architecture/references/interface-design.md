# Interface Design Follow-Up

Use this only after the user chooses one deepening candidate and asks to explore interface alternatives.

## 1. Frame Constraints

Briefly state:

- Current caller responsibilities
- Behavior that should move behind the seam
- Dependencies and whether they are in-process, local-substitutable, external, or test-only
- Error modes and ordering constraints callers currently need to know
- Tests that should survive after the deepening

Use a small code sketch only to anchor constraints. Do not present it as the chosen design.

## 2. Compare Alternatives

Create at least three materially different interfaces:

- Minimal: one to three entry points, maximum leverage per entry point.
- Flexible: supports extension without spreading knowledge across callers.
- Common path: makes the dominant caller trivial.
- Ports/adapters: include this only when multiple real adapters justify the seam.

For each alternative, show:

- Interface shape
- Caller example
- Hidden implementation responsibilities
- Adapter strategy
- Trade-offs in depth, locality, and test surface

## 3. Recommend

Pick one design or a hybrid. Explain why it best improves leverage and locality while staying inside this repo's current scope and provider/context-sync contracts.
