---
phase: 6
slug: adapter-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash (bats or manual shell assertions) |
| **Config file** | none — Wave 0 installs stub test scripts |
| **Quick run command** | `bash .claude/aco/tests/smoke-adapters.sh` |
| **Full suite command** | `bash .claude/aco/tests/smoke-adapters.sh && bash .claude/aco/tests/test-routing.sh` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash .claude/aco/tests/smoke-adapters.sh`
- **After every plan wave:** Run `bash .claude/aco/tests/smoke-adapters.sh && bash .claude/aco/tests/test-routing.sh`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | ADPT-01 | integration | `bash .claude/aco/tests/smoke-adapters.sh gemini` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | ADPT-02 | integration | `bash .claude/aco/tests/smoke-adapters.sh copilot` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | ADPT-03 | unit | `bash .claude/aco/tests/test-error-handling.sh` | ❌ W0 | ⬜ pending |
| 6-01-04 | 01 | 2 | ADPT-04 | integration | `bash .claude/aco/tests/test-routing.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.claude/aco/tests/smoke-adapters.sh` — smoke test stubs for ADPT-01, ADPT-02
- [ ] `.claude/aco/tests/test-error-handling.sh` — error output stubs for ADPT-03
- [ ] `.claude/aco/tests/test-routing.sh` — routing config stubs for ADPT-04

*Wave 0 must create all test stubs before implementation waves begin.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Copilot stdin piping behavior | ADPT-02 | Docs don't specify; needs empirical test | Run `echo "test" \| copilot -p "test"` and verify output captured |
| Copilot unauthenticated error code | ADPT-03 | Exit code unknown; needs live test | Log out of Copilot CLI and run command, observe exit code |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
