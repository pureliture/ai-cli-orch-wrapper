# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Wrapper Command Consolidation

**Shipped:** 2026-03-31
**Phases:** 2 | **Plans:** 7 | **Sessions:** n/a

### What Was Built
- `aco` became the sole supported public command surface across install, help, version, and stale-command recovery
- `.wrapper.json` and `.wrapper/workflows` stayed stable while internal config and artifact symbols moved to Aco branding
- built-ins-first dispatch was restored and locked so reserved alias names cannot break `help`, `setup`, `workflow`, or `workflow-run`

### What Worked
- phase summaries and verification reports made the late milestone audit and correction tractable
- targeted dist-backed runtime tests gave fast confidence on the real command surface without reopening unrelated areas

### What Was Inefficient
- Phase 05 initially encoded the wrong `CMD-03` behavior, so the milestone audit had to trigger a late correction before archive
- validation artifacts lagged the implementation, leaving Nyquist hygiene partial at ship time

### Patterns Established
- keep public CLI branding and repo-local disk contracts decoupled during rename migrations
- treat reserved alias names as inert so built-ins stay authoritative regardless of user config

### Key Lessons
1. Milestone completion needs a real integration audit before archive/tag, not just per-phase pass signals.
2. Command-surface migrations need explicit reserved-name and stale-install-state coverage, not only happy-path help/version tests.

### Cost Observations
- Model mix: n/a
- Sessions: n/a
- Notable: retained phase artifacts kept the late gap closure small and reviewable.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | n/a | 3 | Established wrapper portability, aliases, and workflow orchestration baseline |
| v1.1 | n/a | 2 | Split public `aco` branding from the stable `.wrapper*` runtime contract and added milestone-audit enforcement |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | baseline CLI + workflow coverage | n/a | setup + orchestration core |
| v1.1 | 45 targeted runtime tests in the final verification sweep | targeted command-surface/runtime coverage | stale-bin cleanup script only |

### Top Lessons (Verified Across Milestones)

1. File-backed artifacts are the most reliable completion signal when external CLI sessions are noisy or asynchronous.
2. Small, milestone-scoped runtime changes stay manageable when the public surface and on-disk contracts are tested separately.
