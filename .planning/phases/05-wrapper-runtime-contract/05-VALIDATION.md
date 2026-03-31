---
phase: 05
slug: wrapper-runtime-contract
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-31
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest / TypeScript |
| **Config file** | `tsconfig.json`, `package.json` |
| **Quick run command** | `npm test -- test/config.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- {related_test}.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-02-01 | 02 | 1 | WRAP-01 | unit | `npm test -- test/config.test.ts` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 2 | WRAP-02 | unit | `npm test -- test/artifacts.test.ts` | ✅ | ⬜ pending |
| 05-04-01 | 04 | 3 | CMD-03 | unit | `npm test -- test/canonical-command-surface.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/canonical-command-surface.test.ts` — updated for conflict check
- [ ] `test/config.test.ts` — updated for AcoConfig symbols

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| .wrapper.json creation | WRAP-01 | Side effect | Run `aco setup` and verify `.wrapper.json` creation |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
