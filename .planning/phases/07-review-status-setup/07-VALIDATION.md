---
phase: 7
slug: review-status-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bash (same as Phase 6 test files) |
| **Config file** | None — standalone scripts |
| **Quick run command** | `bash .claude/aco/tests/test-review-commands.sh` |
| **Full suite command** | `bash .claude/aco/tests/smoke-adapters.sh && bash .claude/aco/tests/test-error-handling.sh && bash .claude/aco/tests/test-routing.sh && bash .claude/aco/tests/test-review-commands.sh` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash .claude/aco/tests/test-review-commands.sh`
- **After every plan wave:** Run full suite (all 4 test scripts)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | REV-01, REV-02, REV-03, STAT-01 | unit | `bash .claude/aco/tests/test-review-commands.sh` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | REV-01 | integration | `bash .claude/aco/tests/test-review-commands.sh` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | REV-02 | unit | `bash .claude/aco/tests/test-review-commands.sh` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | REV-03 | unit | `bash .claude/aco/tests/test-review-commands.sh` | ❌ W0 | ⬜ pending |
| 07-01-05 | 01 | 2 | STAT-01 | unit | `bash .claude/aco/tests/test-review-commands.sh` | ❌ W0 | ⬜ pending |
| 07-01-06 | 01 | 2 | SETUP-01 | manual | visual verification | N/A | ⬜ pending |
| 07-01-07 | 01 | 2 | STAT-02 | manual | manual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.claude/aco/tests/test-review-commands.sh` — stubs for REV-01, REV-02, REV-03, STAT-01
- [ ] `.claude/aco/prompts/gemini/reviewer.md` — required by test harness for review command invocation
- [ ] `.claude/aco/prompts/copilot/reviewer.md` — required by test harness for review command invocation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Install + auth instructions printed | SETUP-01 | Static string output — no logic to test | Run `/gemini:setup` and `/copilot:setup`, verify install command and auth steps are present |
| Routing config display | STAT-02 | Scope deferred — availability+version sufficient for Phase 7 ROADMAP criteria | Run `/gemini:status` and `/copilot:status`, verify `✓`/`✗` and version string |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
