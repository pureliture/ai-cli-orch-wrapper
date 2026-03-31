# Milestones

## v1.1 Wrapper Command Consolidation (Shipped: 2026-03-31)

**Phases completed:** 2 phases, 7 plans, 6 tasks

**Key accomplishments:**

- Locked `aco` as the only supported public CLI surface across install, help, version, and ordinary error output
- Added stale `wrapper` remediation plus owned-shim cleanup so pre-`aco` machines recover cleanly during relink/reinstall
- Preserved `.wrapper.json` and `.wrapper/workflows` as the repo-local runtime contract while internal config/artifact symbols moved to Aco branding
- Restored built-ins-first dispatch so reserved alias names cannot block `help`, `setup`, `workflow`, or `workflow-run`
- Extended targeted runtime coverage to prove command-surface behavior, setup continuity, and workflow artifact continuity together

---

## v1.0 ai-cli-orch-wrapper (Shipped: 2026-03-25)

**Phases completed:** 3 phases, 10 plans, 24 tasks

**Key accomplishments:**

- Single-command, idempotent environment bootstrap with tmux config integration
- Repo-local alias and role mapping through `.wrapper.json`
- Strict workflow config resolution plus machine-readable reviewer approval contract
- Repo-local planner/reviewer artifact layout and CAO-backed loop runner
- Successful live named and ad-hoc workflow approvals after runtime hardening

---
