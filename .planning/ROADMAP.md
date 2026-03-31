# Roadmap: ai-cli-orch-wrapper

## Milestones

- ✅ **v1.0 Core Wrapper Foundation** - Phases 01-03 shipped 2026-03-25 ([roadmap archive](./milestones/v1.0-ROADMAP.md), [requirements archive](./milestones/v1.0-REQUIREMENTS.md))
- 🚧 **v1.1 Isolated Workspaces + Workflow Ergonomics** - Phases 04-07 active

## Overview

v1.1 extends the shipped v1.0 wrapper into a safer execution layer. The milestone adds isolated workmux/worktree lifecycle commands, workspace-safe alias and workflow execution, richer workflow stop and resume control, and provider preflight or warmup flows that reduce long-run session friction without compromising the portability of the base checkout.

## Phases

- [ ] **Phase 04: Workspace Lifecycle** - Start, inspect, reopen, and clean isolated workspaces from one CLI surface.
- [ ] **Phase 05: Workspace-Aware Runs** - Run aliases and named workflows inside isolated workspaces with clear stop guidance.
- [ ] **Phase 06: Workflow Outcome Control** - Support configurable workflow states and rerun from the latest preserved iteration context.
- [ ] **Phase 07: Provider Readiness + Warmup** - Surface provider readiness issues early and reduce first-run bootstrap friction.

## Phase Details

### Phase 04: Workspace Lifecycle
**Goal**: Users can manage the full isolated workspace lifecycle from the wrapper CLI without manual worktree or tmux bookkeeping.
**Depends on**: Phase 03
**Requirements**: WORK-01, WORK-02, WORK-04
**Success Criteria** (what must be TRUE):
  1. User can create an isolated workmux/worktree workspace for a target repository with one `wrapper` command.
  2. User can inspect or reopen a previously created isolated workspace without manually reconstructing worktree or workmux state.
  3. User can clean up an isolated workspace and its related workmux or tmux resources with one `wrapper` command.
**Plans**: TBD

### Phase 05: Workspace-Aware Runs
**Goal**: Users can run everyday wrapper commands inside isolated workspaces and get clear runtime guidance without polluting the base checkout.
**Depends on**: Phase 04
**Requirements**: WORK-03, FLOW-01, FLOW-04
**Success Criteria** (what must be TRUE):
  1. User can run wrapper aliases inside an isolated workspace and the command operates on the workspace checkout rather than the base checkout.
  2. User can choose from multiple named inter-CLI workflow templates declared in repo-local config when invoking workflows through the wrapper.
  3. When a workflow stops, the CLI explains the stop reason and the next valid action instead of leaving the user to inspect artifacts manually.
**Plans**: TBD

### Phase 06: Workflow Outcome Control
**Goal**: Users can express richer workflow outcomes in config and continue a stopped workflow from preserved context instead of starting over.
**Depends on**: Phase 05
**Requirements**: FLOW-02, FLOW-03
**Success Criteria** (what must be TRUE):
  1. User can define reviewer outcomes beyond `approved` and `changes_requested` through repo-local config without editing source code.
  2. User can rerun a workflow from the latest saved iteration context instead of restarting from iteration 1.
  3. User can tell from the persisted workflow state whether the next action is a continue, retry, or user-intervention path.
**Plans**: TBD

### Phase 07: Provider Readiness + Warmup
**Goal**: Users can validate provider readiness before long runs and recover from startup friction with guided preflight and warmup flows.
**Depends on**: Phase 06
**Requirements**: SESS-01, SESS-02, SESS-03
**Success Criteria** (what must be TRUE):
  1. User can run a provider preflight check before starting a long workflow and see readiness issues up front.
  2. If CAO or provider session bootstrap fails or stalls, the CLI returns immediately actionable remediation guidance.
  3. User can opt into a lightweight warmup or bootstrap flow for supported providers before the main workflow starts.
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 01. Foundation + Environment Setup | v1.0 | 2/2 | Complete | 2026-03-25 |
| 02. CLI Aliases + Workflow Config | v1.0 | 4/4 | Complete | 2026-03-25 |
| 03. Plan→Review Orchestration Loop | v1.0 | 4/4 | Complete | 2026-03-25 |
| 04. Workspace Lifecycle | v1.1 | 0/TBD | Not started | - |
| 05. Workspace-Aware Runs | v1.1 | 0/TBD | Not started | - |
| 06. Workflow Outcome Control | v1.1 | 0/TBD | Not started | - |
| 07. Provider Readiness + Warmup | v1.1 | 0/TBD | Not started | - |
