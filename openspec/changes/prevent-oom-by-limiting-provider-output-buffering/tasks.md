## 1. Output policy contract

- [x] 1.1 Add provider invocation output policy types and defaults to `packages/wrapper/src/providers/interface.ts` (policy mode + max bytes).
- [x] 1.2 Extend `packages/wrapper/src/util/spawn-stream.ts` output handling options to support `stream-only`, `bounded`, and `disabled` modes with validation.
- [x] 1.3 Ensure bounded mode exposes a size-capped output snapshot without allocating unbounded memory.

## 2. Call site wiring

- [x] 2.1 Update `packages/wrapper/src/cli.ts` to pass explicit safe default output mode into provider invocation.
- [x] 2.2 Update `packages/wrapper/src/commands/ask.ts` to request bounded output only where the caller truly needs it and keep default path in streaming-safe mode.
- [x] 2.3 Add/adjust unit tests for command-level invocation option wiring in relevant test files.

## 3. Verification and docs

- [x] 3.1 Add a regression test that streams a large synthetic provider output and verifies bounded memory growth for bounded mode.
- [x] 3.2 Add a regression test that verifies default mode does not retain unbounded in-memory output.
- [x] 3.3 Update operator-facing documentation/comments for the new policy and rollback-safe behavior, then run focused validation commands (`npm run typecheck`, `npm test`, targeted fixture tests).
