## 1. Schema and artifact contract

- [ ] 1.1 Define `findings.json` v1 schema in docs and TypeScript types.
- [ ] 1.2 Decide whether `findings.json` is always created or only created when findings exist.
- [ ] 1.3 Document advisory status, parse status, severity scale, confidence, evidence, and validation fields.

## 2. Parser and writer behavior

- [ ] 2.1 Add deterministic mock-provider structured findings extraction.
- [ ] 2.2 Add generic fallback behavior for unstructured provider output.
- [ ] 2.3 Persist session-level `findings.json` and reference it from run-level `ledger.json`.
- [ ] 2.4 Ensure parse errors are captured without changing successful provider invocation status.

## 3. CLI and docs integration

- [ ] 3.1 Update `aco result` only if needed for discoverability; preserve default behavior.
- [ ] 3.2 Update `docs/reference/session-artifacts.md`.
- [ ] 3.3 Update `docs/security.md` to state structured findings are advisory and not redacted.
- [ ] 3.4 Add README or runbook examples using mock provider only.

## 4. Verification

- [ ] 4.1 Add focused tests for valid, empty, and malformed findings.
- [ ] 4.2 Verify `brief`, `save-only`, and `full` output modes still behave as documented.
- [ ] 4.3 Run `openspec validate add-structured-findings-artifacts --type change --strict`.
- [ ] 4.4 Run `npm run build`, `npm test --workspace=packages/wrapper`, and `npm run typecheck`.
