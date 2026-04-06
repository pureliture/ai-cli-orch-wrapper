## Why

The repository has a Node.js wrapper that already spawns provider CLIs and manages session lifecycle, but it does not define which parts of `ccg-workflow`'s `codeagent-wrapper` behavior it intends to match. Without a written contract, "compatible with ccg-workflow" is easy to over-claim and hard to verify.

## What Changes

- Add an OpenSpec change that defines a narrow `ccg-workflow` compatibility contract for this repository's wrapper behavior.
- Document the compatibility scope around process spawn, stdout/stderr streaming, PID tracking, cancellation, and exit/timeout semantics.
- Explicitly exclude `ccg-workflow` surfaces that are not needed in the current environment, including Windows-only process handling, browser opening, and SSE/web UI features.
- Record the current implementation gaps between `@aco/wrapper` and `ccg-workflow`'s `codeagent-wrapper` so later implementation work has a stable baseline.

## Capabilities

### New Capabilities
- `ccg-wrapper-compatibility-contract`: Define the wrapper behaviors that this repository SHALL match, the `ccg-workflow` surfaces that are intentionally out of scope, and the observable gaps remaining in the current implementation.

### Modified Capabilities

## Impact

- Affected paths: `openspec/changes/document-ccg-wrapper-compatibility/`
- Related code for future implementation: `packages/wrapper/src/cli.ts`, `packages/wrapper/src/util/spawn-stream.ts`, `packages/wrapper/src/providers/`
- No runtime APIs or dependencies change in this documentation change
