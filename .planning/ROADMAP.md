# Roadmap: ai-cli-orch-wrapper

## Milestones

- ✅ **v1.0 Core Wrapper Foundation** - Phases 01-03 shipped 2026-03-25 ([roadmap archive](./milestones/v1.0-ROADMAP.md), [requirements archive](./milestones/v1.0-REQUIREMENTS.md))
- 🚧 **v1.1 Wrapper Command Consolidation** - Phases 04-05 active
- Planned: **v1.2 Documentation + Architecture Cleanup**
- Planned: **v1.3 Isolated Workspaces + Workflow Ergonomics**

## Overview

v1.1 is a narrowing milestone. Before this wrapper grows into workspace management and richer multi-step orchestration again, the CLI needs one stable public name and one stable repo-local contract. This milestone locks `aco` as the canonical public command across install, help, error handling, and stale-invocation recovery, while explicitly preserving the existing `.wrapper*` runtime contract until Phase 05. Documentation cleanup remains pushed to v1.2 and workspace/runtime expansion to v1.3.

## Phases

- [ ] **Phase 04: Canonical Command Surface** - Standardize `aco` as the single visible CLI name and recovery path.
- [ ] **Phase 05: Wrapper Runtime Contract** - Keep setup, alias, and workflow behaviors consistent with the existing `.wrapper*` repo-local contract.

## Phase Details

### Phase 04: Canonical Command Surface
**Goal**: Users can discover, invoke, and recover to the `aco` command without ambiguity while `.wrapper*` runtime paths stay intact for the next phase.
**Depends on**: Phase 03
**Requirements**: CMD-01, CMD-02, WRAP-03
**Success Criteria** (what must be TRUE):
  1. User can invoke the installed CLI with the canonical `aco` command on a supported machine.
  2. Help, usage, version, and command error output all identify the tool as `aco`.
  3. If the user reaches a stale command invocation path, the CLI tells them directly to use `aco`.
**Plans**: 2 plans
Plans:
- [x] 04-01-PLAN.md — Cut over the install/help/version surface and public quick-start guidance to `aco`
- [ ] 04-02-PLAN.md — Fail fast on stale `wrapper` entrypaths and align setup-managed wording to `aco`

### Phase 05: Wrapper Runtime Contract
**Goal**: Users can trust the existing v1.0 runtime flows to keep working once `wrapper` is treated as the canonical command contract.
**Depends on**: Phase 04
**Requirements**: CMD-03, WRAP-01, WRAP-02
**Success Criteria** (what must be TRUE):
  1. User can run `wrapper setup` and get repo-local config initialized through the `.wrapper.json` contract without manual rename work.
  2. User can run alias and workflow entrypoints through `wrapper` while artifacts continue to land under the expected `.wrapper/` paths.
  3. Built-in subcommands continue to take precedence over alias names after the command surface is consolidated.
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 01. Foundation + Environment Setup | v1.0 | 2/2 | Complete | 2026-03-25 |
| 02. CLI Aliases + Workflow Config | v1.0 | 4/4 | Complete | 2026-03-25 |
| 03. Plan→Review Orchestration Loop | v1.0 | 4/4 | Complete | 2026-03-25 |
| 04. Canonical Command Surface | v1.1 | 1/2 | In Progress|  |
| 05. Wrapper Runtime Contract | v1.1 | 0/TBD | Not started | - |
