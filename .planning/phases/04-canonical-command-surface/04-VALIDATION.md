---
phase: 04
slug: canonical-command-surface
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-31
updated: 2026-03-31
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | none |
| **Quick run command** | `npm run build && node --test test/canonical-command-surface.test.ts test/workflow-cli.test.ts test/setup.test.ts test/install-state-cleanup.test.ts` |
| **Full suite command** | `npm run build && npm test && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run that task's exact `<automated>` verifier from the active PLAN.md
- **After every plan wave:** Run the combined Phase 04 suite: `npm run build && node --test test/canonical-command-surface.test.ts test/workflow-cli.test.ts test/setup.test.ts test/install-state-cleanup.test.ts && npm run lint`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CMD-01 | integration | `cd /Users/pureliture/ai-cli-orch-wrapper && npm run build && node --test test/canonical-command-surface.test.ts test/workflow-cli.test.ts` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | CMD-02 | integration | `cd /Users/pureliture/ai-cli-orch-wrapper && npm run build && node --test test/canonical-command-surface.test.ts test/workflow-cli.test.ts && npm run lint` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | WRAP-03 | integration | `cd /Users/pureliture/ai-cli-orch-wrapper && npm run build && node --test test/canonical-command-surface.test.ts test/setup.test.ts` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 2 | CMD-02 | integration | `cd /Users/pureliture/ai-cli-orch-wrapper && npm run build && node --test test/canonical-command-surface.test.ts test/setup.test.ts test/workflow-cli.test.ts && npm run lint` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 3 | CMD-01, WRAP-03 | integration | `cd /Users/pureliture/ai-cli-orch-wrapper && node --test test/install-state-cleanup.test.ts` | ✅ | ⬜ pending |
| 04-03-02 | 03 | 3 | CMD-01, WRAP-03 | integration | `cd /Users/pureliture/ai-cli-orch-wrapper && npm run build && node --test test/install-state-cleanup.test.ts test/canonical-command-surface.test.ts && npm run lint && npm link && npm run cleanup:legacy-bin && node -e \"const fs=require('node:fs'); const path=require('node:path'); const {execSync,spawnSync}=require('node:child_process'); const prefix=(process.env.ACO_BIN_CLEANUP_PREFIX || execSync('npm prefix -g',{encoding:'utf8'})).trim(); const binDir=path.join(prefix,'bin'); const wrapperBin=path.join(binDir,'wrapper'); const acoBin=path.join(binDir,'aco'); const pkgCli=path.resolve('dist/cli.js'); if (fs.existsSync(wrapperBin)) { const wrapperTarget=fs.realpathSync(wrapperBin); const acoTarget=fs.existsSync(acoBin) ? fs.realpathSync(acoBin) : null; if (wrapperTarget === pkgCli || (acoTarget && wrapperTarget === acoTarget)) { console.error('package-owned wrapper shim still present'); process.exit(1); } } if (!fs.existsSync(acoBin)) { console.error('aco shim missing after relink'); process.exit(1); } const result=spawnSync(acoBin,['help'],{stdio:'ignore'}); process.exit(result.status ?? 1);\"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None. Every Phase 04 task now has an explicit `<automated>` verifier in the current PLAN.md set, including the gap-closure plan.

---

## Manual-Only Verifications

None required for Nyquist coverage. Human spot-checks remain optional, but install/relink state, canonical help output, stale invocation remediation, and setup wording are all covered by automated Phase 04 verifiers.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
