## Why

`aco ask` currently stores full provider output in `output.log` and summarizes it into bounded briefs. This is useful for token control, but it is still mostly prose. A maintainer or supervising agent must read unstructured output to know which issues were found, how severe they are, what files are implicated, and what validation is suggested.

That weakens gray box operation. To treat provider output as a reviewable advisory artifact without trusting its internals blindly, findings need a structured boundary.

## What Changes

- Add a structured findings artifact for `aco ask` provider sessions.
- Keep `output.log` as the full raw provider output.
- Keep `brief.md` as the human-readable summary.
- Add a machine-readable artifact such as `findings.json` with a stable schema.
- Provide parser behavior for providers that can emit structured findings and conservative fallback behavior for providers that cannot.

## Capabilities

### New Capabilities

- `structured-findings-artifacts`: `aco ask` sessions can persist structured advisory findings with severity, evidence, suggested fix, and validation metadata.

### Modified Capabilities

- `aco ask` artifact layout expands from raw output plus brief to raw output plus brief plus optional or required structured findings.
- `aco result` may gain an option to display structured findings, but the default output contract should remain backward compatible.

## Impact

- `packages/wrapper/src/commands/ask.ts`: write findings artifact and ledger references.
- `packages/wrapper/src/runtime/provider-session-runner.ts`: no broad changes expected unless structured parsing is centralized.
- `packages/wrapper/src/providers/*`: provider-specific summarization or parsing hooks may be added.
- `packages/wrapper/src/session/store.ts`: may expose paths for findings artifacts.
- `docs/reference/session-artifacts.md`: document the new artifact and schema.
- `docs/security.md`: clarify that structured findings are advisory and not redacted.
- Tests: add fixture coverage for valid findings, malformed provider output, empty findings, and backwards compatibility.

## Non-Goals

- Do not make provider findings authoritative.
- Do not remove `output.log`.
- Do not require every real provider to emit perfect JSON in the first slice.
- Do not implement automatic issue creation or PR comments in this workflow.
- Do not add secret scanning unless a separate security workflow is approved.
