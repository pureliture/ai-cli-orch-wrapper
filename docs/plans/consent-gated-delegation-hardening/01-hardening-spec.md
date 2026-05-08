# Consent-Gated Delegation Hardening Spec

작성일: 2026-05-08
상태: Proposed

## Problem

PR #92 added the consent-gated `aco ask` MVP, but the branch is not yet ready to present as an open-source quality external AI delegation wrapper. Known gaps are:

- `ask.ts` has a Prettier failure that blocks CI lint.
- `collectInput()` calls `.trim()`, which changes user-provided leading/trailing whitespace and final newlines.
- `brief` mode returns only metadata and paths, so users must call `aco result` even for a small bounded provider summary.
- There is no non-network `aco doctor` command.
- Security and artifact docs do not clearly separate implemented guarantees from future work.
- Root metadata and some docs still describe the project as Gemini-centric or pre-MVP.

## Functional Requirements

### FR1: Raw Input Preservation

`aco ask` must preserve explicit input content.

Acceptance criteria:

- `--input "  demo"` preserves leading spaces.
- `--input "demo\n"` preserves trailing newline.
- `--input-file path` preserves file content exactly as decoded UTF-8.
- Combined `--input` plus `--input-file` is deterministic and joins the two explicit sources with exactly two newline characters between sources.
- `aco ask` must not wait for stdin when no explicit input is supplied.

### FR2: Bounded Brief Summary

`aco ask --output-mode brief` must include a bounded provider result summary.

Acceptance criteria:

- Summary is derived from provider output and bounded by a documented character limit.
- Brief output includes status/session/output path plus `Summary:` for each provider.
- Brief output does not include full provider output beyond the bound.
- `save-only` prints only run/session save locations, no summary/body.
- `full` prints full provider output only when explicitly requested.
- The bounded summary is saved in session/run artifact briefs and `ledger.json`.

### FR3: Artifact Layout v1

Session/run artifact layout must be documented and stable enough for open-source users to inspect.

Required layout:

```text
~/.aco/runs/<run-id>/ledger.json
~/.aco/runs/<run-id>/brief.md
~/.aco/sessions/<session-id>/task.json
~/.aco/sessions/<session-id>/input.md
~/.aco/sessions/<session-id>/prompt.md
~/.aco/sessions/<session-id>/output.log
~/.aco/sessions/<session-id>/brief.md
~/.aco/sessions/<session-id>/error.log   # only when applicable
```

Non-goal:

- Do not add `findings.json` in Goal 2 unless a schema and tests are explicitly introduced.

### FR4: `aco doctor` v1

Add a small local-only health check command.

Checks:

- Node version.
- `aco` version.
- git repository detection.
- `.claude` harness presence.
- generic `/aco` command presence.
- `aco-delegation` skill presence.
- provider availability for `mock`, `codex`, `gemini`.
- local credential readiness heuristics using existing provider auth checks.
- sync drift/check status when feasible without writing files.

Safety criteria:

- Does not perform network calls.
- Does not invoke real providers.
- Does not print secrets.
- Reports remote auth status only as local heuristic readiness.

### FR5: Security Documentation

Add `docs/security.md` and update README/docs references.

Must explain:

- Consent-gated execution and `--yes`.
- What `aco ask` sends to providers.
- Output-mode token-saving model.
- Session artifact storage.
- Inherited environment caveat for Node wrapper provider execution.
- Go runtime allowlist boundary and that it does not automatically apply to Node wrapper provider execution.
- Secrets policy.
- `.acoignore` status as example/future until enforcement exists.
- How to inspect artifacts.

### FR6: Docs And Visualization Refresh

Update public-facing docs and diagrams so they match Goal 2.

Required docs:

- `README.md`
- `docs/README.md`
- `docs/architecture.md`
- `docs/guides/runbook.md`
- `docs/reference/context-sync.md` if delegation surfaces intersect sync docs
- `docs/reference/session-artifacts.md`
- `docs/security.md`
- hardening plan ledger files
- root/package metadata if still misleading
- `.claude/commands/aco.md` and `templates/commands/aco.md` only if command text changes

Required diagrams:

- `docs/images/architecture-overview.svg`
- `docs/images/context-sync.svg`
- `docs/images/session-lifecycle.svg`
- `docs/images/repository-structure.svg`
- `docs/images/ci-pipeline.svg`

Diagram criteria:

- Show Claude Code consent gate.
- Show one generic `/aco` command.
- Show `aco ask`.
- Show provider execution as advisory.
- Show run/session artifacts.
- Show bounded brief vs full output.
- Show mock no-auth demo.

## Non-Functional Requirements

- Preserve existing CLI compatibility for `aco run`, `aco result`, `aco status`, `aco cancel`, `aco sync`, `aco pack`, and `aco provider setup`.
- Default permission profile remains `restricted`.
- Default output mode remains `brief`.
- Default provider remains `mock` for no-auth demo safety unless changed by explicit future product decision.
- All tests use temp `HOME` and do not depend on real Codex/Gemini credentials.
- Formatting must pass with existing `format:check`.

## Design Decision

Keep `aco ask` as the high-level orchestration layer above `aco run`, with one generic Claude `/aco` command and task-specific behavior in natural language, presets, or CLI flags. This preserves the product thesis while avoiding slash-command sprawl.

## Risks

- `provider.checkAuth()` includes CLI version fallback and can execute local binaries. `aco doctor` must treat this as local heuristic only and must not invoke `provider.invoke()`.
- Brief summaries can accidentally become too verbose if bounded by lines rather than characters. Use a fixed character bound.
- Updating generated/context-sync surfaces by hand can drift from sync contracts. Keep generated block changes minimal and record if `aco sync --check` reports drift.
