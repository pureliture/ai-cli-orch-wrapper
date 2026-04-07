## Context

This repository currently defines itself as a provider-based Node.js wrapper runtime for `aco`, with explicit session storage and subprocess dispatch responsibilities. The local wrapper already spawns provider processes, records the child PID, streams stdout to a session log, captures bounded stderr, and sends `SIGTERM` on cancellation.

`ccg-workflow` uses a different split: the package itself is Node/TypeScript, but its `codeagent-wrapper` is a separate Go binary. The inspected `codeagent-wrapper` source includes a broader surface than this repository currently needs, including SSE live output, browser opening, Windows console suppression, Windows process-state checks, and cross-platform binary builds.

The user's concern is not "rewrite everything in Go now"; it is whether this repository can make a credible compatibility claim without a written contract. This change answers that by defining a narrow compatibility target for the current environment and by documenting the gaps that still exist against that target.

## Goals / Non-Goals

**Goals:**
- Define the observable wrapper behaviors that matter for `ccg-workflow`-style process execution in the current environment
- Limit the contract to Linux/macOS-relevant process lifecycle concerns
- Make exclusions explicit so the repository does not imply parity with irrelevant `codeagent-wrapper` features
- Record the current gaps between the local wrapper contract and the narrower `ccg-workflow` contract

**Non-Goals:**
- Replacing the Node.js wrapper with Go
- Claiming full parity with `ccg-workflow`
- Specifying Windows-only behaviors such as console hiding or Windows process polling
- Specifying SSE/web UI streaming, browser auto-open, or multi-backend orchestration behavior
- Implementing the missing compatibility behaviors in this change

## Decisions

### Decision: Define compatibility at the behavior level, not the language level
The contract will describe observable process lifecycle behavior rather than implementation language. This avoids treating "written in Go" as a proxy for compatibility.

Alternative considered: require Go implementation for compatibility.
Why not chosen: language choice alone does not guarantee matching spawn, stream, cancel, or exit semantics.

### Decision: Narrow the contract to local-environment-critical surfaces
The contract will focus on process spawn, argument dispatch, stdout/stderr handling, PID capture, cancellation, and exit/timeout semantics.

Alternative considered: document every `codeagent-wrapper` surface.
Why not chosen: that would force this repository to carry Windows and UI concerns that are not needed in the current environment.

### Decision: Exclude Windows-only and UI/server behavior explicitly
The change will explicitly mark Windows console handling, Windows process checks, browser opening, SSE/web server output, and cross-platform binary packaging as out of scope.

Alternative considered: leave those areas undocumented.
Why not chosen: omission would keep the compatibility claim ambiguous and invite incorrect assumptions about parity.

### Decision: Treat the current repository state as a documented gap baseline
The design and tasks will record the specific behaviors that are present today versus the behaviors that the compatibility contract would eventually require.

Alternative considered: write only future-state requirements.
Why not chosen: the user explicitly asked what is currently missing, so the gap list is part of the value of this change.

## Current Gap Snapshot

### Already present in the local wrapper
- Provider subprocess spawn exists through `spawn()`-based invocation
- Child PID is recorded for later cancellation
- Provider stdout is streamed incrementally to the session output log
- Provider stderr is captured in bounded form for failure diagnostics
- Cancellation sends `SIGTERM` to the recorded child PID and marks the session cancelled

### Missing or underspecified relative to the narrow compatibility contract
- Timeout semantics are not part of the local wrapper contract today
- Exit behavior is captured generically, but there is no compatibility definition for post-message drain timing or delayed completion handling
- The contract does not yet state whether environment propagation must match `codeagent-wrapper`
- Cancellation relies on a stored PID, but there is no stronger process-identity verification contract
- The repository does not yet ship fixture-based compatibility tests against `ccg-workflow` behavior snapshots
- The repository documentation does not yet describe the current wrapper as only partially aligned with `ccg-workflow`

## Risks / Trade-offs

- [Narrow contract may be mistaken for full parity] → State exclusions in both design and specs, not only in tasks
- [Remote `ccg-workflow` behavior can evolve] → Anchor the comparison to the inspected `main` branch state as of 2026-04-03 and revisit if parity work begins later
- [Doc-only change may look "done" without implementation] → Keep implementation work as unchecked tasks and describe the current wrapper as partially aligned, not compatible
- [Timeout semantics remain underspecified in local code] → Call this out as a concrete gap instead of implying current parity

## Migration Plan

1. Create the proposal, spec, and tasks for the narrow compatibility contract.
2. Document the excluded surfaces and current gap list.
3. Validate the OpenSpec artifacts.
4. If future implementation starts, use this change as the baseline for code and tests.

Rollback is clean: remove this change directory if the repository decides not to pursue compatibility documentation.

## Open Questions

- Whether future compatibility work should also cover stdin payload handling and environment propagation in more detail
- Whether timeout behavior should be defined at the wrapper layer or delegated entirely to provider CLIs
- Whether compatibility verification should be based on fixture-driven golden tests against `codeagent-wrapper` behavior snapshots
