## Context

The current artifact model is intentionally conservative: full output is saved, bounded summaries protect the active Claude Code context, and `mock` enables deterministic tests. The missing piece is a structured review boundary.

Structured findings should let maintainers inspect "what the provider claims" without reading the entire provider transcript. The artifact must remain advisory, reproducible, and safe to ignore if parsing fails.

## Goals / Non-Goals

**Goals:**

- Define a stable `findings.json` schema for `aco ask` session artifacts.
- Support provider-specific structured extraction where available.
- Fall back safely when output is unstructured or malformed.
- Keep run-level `ledger.json` aware of findings count and artifact path.
- Preserve current `brief`, `save-only`, and `full` output modes.

**Non-Goals:**

- No automatic remediation.
- No automatic GitHub issue or review comment creation.
- No claim that a finding is true without maintainer validation.
- No full provider prompt redesign in the first slice.

## Candidate Schema

```json
{
  "schemaVersion": "1",
  "sessionId": "uuid",
  "provider": "mock",
  "command": "ask",
  "generatedAt": "2026-05-12T00:00:00.000Z",
  "source": {
    "outputLog": "~/.aco/sessions/<id>/output.log",
    "parser": "mock-v1"
  },
  "findings": [
    {
      "id": "F001",
      "severity": "P1",
      "title": "Brief title",
      "summary": "One-paragraph advisory claim.",
      "evidence": [
        {
          "path": "packages/wrapper/src/commands/ask.ts",
          "line": 120,
          "quote": "Short bounded excerpt"
        }
      ],
      "suggestedFix": "What a maintainer should consider changing.",
      "validation": "Focused command or manual check to verify the claim.",
      "confidence": "medium"
    }
  ],
  "parseStatus": "ok"
}
```

## Decisions

1. **Findings are session-scoped**
   - Option A: Only run-level findings.
   - Option B: Session-level findings with run-level aggregation metadata.
   - Decision: choose B. Provider output is session-scoped today, and multi-provider runs need provider attribution.

2. **Parsing failure is not provider failure**
   - Option A: Fail the session when findings parsing fails.
   - Option B: Mark `parseStatus` as `failed` and keep the provider session status based on invocation result.
   - Decision: choose B. Structured parsing is a boundary improvement, not proof that provider execution failed.

3. **Use deterministic mock provider as the first parser target**
   - Option A: Start with real Codex/Gemini parsing.
   - Option B: Start with `mock` and a generic fallback, then add real provider prompt/extraction later.
   - Decision: choose B. This preserves no-auth CI and lets the schema stabilize.

4. **Keep Markdown brief as a reader artifact**
   - Option A: Replace `brief.md` with JSON.
   - Option B: Keep `brief.md` and add `findings.json`.
   - Decision: choose B. Humans still need a compact narrative artifact.

## Risks / Trade-offs

- [Risk] JSON schema creates false confidence. [Mitigation] Every artifact includes advisory language and confidence fields.
- [Risk] Providers hallucinate file paths or lines. [Mitigation] Store findings as claims and add validation guidance; do not auto-apply.
- [Risk] Schema churn breaks consumers. [Mitigation] Include `schemaVersion` and avoid changing v1 fields after release.
- [Risk] Structured artifacts duplicate `brief.md`. [Mitigation] Use JSON for machine-readable findings and brief for human summary only.

## Validation Strategy

- Add tests for `aco ask --providers mock --yes --output-mode brief` creating `findings.json`.
- Add tests for malformed parser output producing `parseStatus: failed` without losing `output.log`.
- Add tests for empty findings.
- Add tests that `save-only` does not print findings body to stdout.
- Run `npm test --workspace=packages/wrapper` and focused artifact tests.

## Open Questions

- Should `findings.json` be required for every successful `aco ask` session, even when there are zero findings?
- Should `aco result --format json` be part of this workflow or a follow-up?
- Should severity use repo review levels `P0` to `P3`, or a provider-neutral scale such as `critical/high/medium/low`?
