---
phase: 03
slug: plan-review-orchestration-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | none — existing project uses `node --test` directly |
| **Quick run command** | `npm run build && node --test test/workflow-config.test.ts test/status-file.test.ts test/artifacts.test.ts` |
| **Full suite command** | `npm run build && npm run lint && node --test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build && node --test test/workflow-config.test.ts test/status-file.test.ts test/artifacts.test.ts`
- **After every plan wave:** Run `npm run build && npm run lint && node --test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ORCH-04 | unit | `npm run build && node --test test/workflow-config.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | ORCH-02 | unit | `npm run build && node --test test/status-file.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | ORCH-03 | unit | `npm run build && node --test test/artifacts.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | ORCH-01 | integration | `npm run build && node --test test/cao-client.test.ts test/workflow-runner.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | ORCH-01, ORCH-02, ORCH-03, ORCH-04 | integration | `npm run build && npm run lint && node --test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/workflow-config.test.ts` — config parsing, workflow validation, override merge coverage
- [ ] `test/status-file.test.ts` — `review.status.json` schema and malformed-file error paths
- [ ] `test/artifacts.test.ts` — run/iteration directory and file path helper coverage
- [ ] `test/cao-client.test.ts` — fake CAO API contract tests using `node:http`
- [ ] `test/workflow-runner.test.ts` — approval, changes-requested, max-iteration, and protocol-failure loop tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real CAO-backed planner→reviewer approval path | ORCH-01, ORCH-02, ORCH-03, ORCH-04 | Requires installed CAO server and real provider CLIs | Start `cao-server`, run `wrapper workflow plan-review`, confirm `.wrapper/workflows/<name>/runs/<id>/iterations/01/plan.md`, `review.md`, and `review.status.json` are created and the command exits `0` on approval. |
| Max-iteration non-approved run with real providers | ORCH-02 | Real provider behavior and shell/runtime timing are environment-specific | Run a workflow configured to emit `changes_requested` through the limit, confirm artifacts for each iteration are preserved and the command exits `2`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
