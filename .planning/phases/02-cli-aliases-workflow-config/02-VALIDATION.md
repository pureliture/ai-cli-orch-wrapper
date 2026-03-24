---
phase: 2
slug: cli-aliases-workflow-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | None — invoked directly via `npm test` |
| **Quick run command** | `npm run build && node --test` |
| **Full suite command** | `npm run build && node --test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build && node --test`
- **After every plan wave:** Run `npm run build && node --test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | 01 | 0 | SETUP/D-07 | unit | `npm run build && node --test test/setup.test.ts` | ✅ (needs update) | ⬜ pending |
| 2-W0-02 | 01 | 0 | ALIAS-01 | unit | `npm run build && node --test test/alias.test.ts` | ❌ W0 | ⬜ pending |
| 2-W0-03 | 01 | 0 | CONFIG-01 | unit | `npm run build && node --test test/config.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-01 | 01 | 1 | CONFIG-01 | unit | `npm run build && node --test test/config.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | ALIAS-01 | unit | `npm run build && node --test test/alias.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | ALIAS-02 | unit | `npm run build && node --test test/alias.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | CONFIG-02 | unit | `npm run build && node --test test/alias.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 2 | CONFIG-03 | manual | code review | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/alias.test.ts` — stubs for ALIAS-01, ALIAS-02, CONFIG-02, unknown-alias error path
- [ ] `test/config.test.ts` — stubs for CONFIG-01 (config read, missing file fallback, malformed JSON fallback)
- [ ] `test/setup.test.ts` line 40 — update assertion: remove old `# Phase 2 will populate CLI alias bindings here.` text, match new `AI_CLI_CONF_CONTENT` text (D-07)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wrapper does not define workflow DSL | CONFIG-03 | Structural/architectural constraint — no runtime assertion possible | Review `.wrapper.json` schema and `src/` source: confirm `roles` section stores only provider name strings, no workflow fields or scheduling logic |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
