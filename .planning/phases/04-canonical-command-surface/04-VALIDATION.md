---
phase: 04
slug: canonical-command-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | none |
| **Quick run command** | `node --test test/alias.test.ts test/workflow-cli.test.ts test/setup.test.ts` |
| **Full suite command** | `npm test && npm run lint` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/alias.test.ts test/workflow-cli.test.ts test/setup.test.ts`
- **After every plan wave:** Run `npm test && npm run lint`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CMD-01 | integration | `node --test test/canonical-command-surface.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CMD-02 | integration | `node --test test/canonical-command-surface.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | WRAP-03 | integration | `node --test test/canonical-command-surface.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | CMD-02 | integration | `npm test && npm run lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/canonical-command-surface.test.ts` — subprocess coverage for `aco`, zero-arg recovery, and stale-invocation remediation
- [ ] Portable packaging smoke assertions for `package.json#bin` plus `npm link` / reinstall behavior, or an explicitly documented manual check if automation stays too platform-specific

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installed executable resolves to `aco` after relink/reinstall | CMD-01 | Global npm bin state depends on the local machine and existing linked shims | Run `npm run build`, then `npm link`, then verify `aco help` succeeds and stale `wrapper help` fails with direct remediation |
| Existing managed tmux config shows acceptable post-cutover wording | WRAP-03 | Managed file rewrite behavior depends on local prior state in `~/.config/tmux/ai-cli.conf` | Run `aco setup`, inspect `~/.config/tmux/ai-cli.conf`, and confirm either neutral/`aco` wording or an explicitly documented non-migration decision |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
