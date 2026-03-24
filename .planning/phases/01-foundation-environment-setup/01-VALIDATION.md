---
phase: 1
slug: foundation-environment-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node --test (built-in) |
| **Config file** | none — native runner, no config file |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | SETUP-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | SETUP-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | SETUP-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | SETUP-04 | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/setup.test.ts` — stubs for SETUP-01, SETUP-02, SETUP-03, SETUP-04
- [ ] `test/fixtures/` — temp-dir HOME fixtures for isolating `~/.tmux.conf` writes

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh clone setup on a machine without cao/tmux/workmux | SETUP-03 | Requires a clean environment without the tools installed | Run `wrapper setup` on a fresh VM/container missing one of the prereqs; confirm error message names the missing tool |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
