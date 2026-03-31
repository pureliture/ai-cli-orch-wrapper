# Roadmap: ai-cli-orch-wrapper

## Milestones

- ✅ **v1.0 Core Wrapper Foundation** - Phases 01-03 shipped 2026-03-25 ([roadmap archive](./milestones/v1.0-ROADMAP.md), [requirements archive](./milestones/v1.0-REQUIREMENTS.md), [audit](./milestones/v1.0-MILESTONE-AUDIT.md))
- ✅ **v1.1 Wrapper Command Consolidation** - Phases 04-05 shipped 2026-03-31 ([roadmap archive](./milestones/v1.1-ROADMAP.md), [requirements archive](./milestones/v1.1-REQUIREMENTS.md), [audit](./milestones/v1.1-MILESTONE-AUDIT.md))
- Planned: **v1.2 Documentation + Architecture Cleanup**
- Planned: **v1.3 Isolated Workspaces + Workflow Ergonomics**

## Current Focus

There is no active milestone. The next planning boundary is `v1.2`, which should:

- align README and install guidance with the shipped `aco` command surface
- document the wrapper architecture, config files, and workflow lifecycle without reverse-engineering the code
- clean up planning and project docs so the shipped runtime contract and future expansion paths are easy to follow

## Deferred Milestones

### v1.3 Isolated Workspaces + Workflow Ergonomics

- isolated workmux/worktree workspace lifecycle
- richer workflow restart and reviewer outcome controls
- provider preflight and lighter bootstrap guidance

---

Next step: run `$gsd-new-milestone` to create a fresh requirements file for `v1.2`.
