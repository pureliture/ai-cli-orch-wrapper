# Roadmap: ai-cli-orch-wrapper

## Overview

Three phases that build the wrapper from the ground up. Phase 1 establishes a working CLI binary and idempotent environment bootstrap — the core portability promise. Phase 2 layers configurable alias and workflow role mappings on top of that foundation. Phase 3 delivers the plan→review inter-CLI loop, the capability that cao alone does not provide. Each phase delivers a coherent, verifiable capability before the next phase depends on it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Environment Setup** - Working CLI binary and single-command idempotent environment bootstrap (completed 2026-03-24)
- [ ] **Phase 2: CLI Aliases + Workflow Config** - Configurable alias-to-CLI mappings and declarative role→CLI workflow config
- [ ] **Phase 3: Plan→Review Orchestration Loop** - File-based inter-CLI plan→review loop with configurable exit conditions

## Phase Details

### Phase 1: Foundation + Environment Setup
**Goal**: Users can bootstrap a complete AI CLI orchestration environment on any machine with a single command
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04
**Success Criteria** (what must be TRUE):
  1. User can run `wrapper setup` on a fresh clone and the environment is fully configured
  2. Re-running `wrapper setup` on an already-configured machine produces no side effects and exits cleanly
  3. Running `wrapper setup` on a machine missing cao, tmux, or workmux exits with a clear error naming the missing tool and a path to fix it
  4. `~/.config/tmux/ai-cli.conf` exists after setup and `~/.tmux.conf` contains exactly one added `source-file` line pointing to it
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Delete PoC files, rewrite src/cli.ts, create src/commands/setup.ts and test scaffold
- [x] 01-02-PLAN.md — Build, run tests, and smoke-test wrapper setup on real machine

### Phase 2: CLI Aliases + Workflow Config
**Goal**: Users can invoke AI CLIs via short wrapper aliases and declare role→CLI mappings in a config file without touching source code
**Depends on**: Phase 1
**Requirements**: ALIAS-01, ALIAS-02, CONFIG-01, CONFIG-02, CONFIG-03
**Success Criteria** (what must be TRUE):
  1. User can invoke `wrapper claude`, `wrapper gemini`, etc. and the correct cao invocation fires
  2. User can edit a config file to add or remap an alias without any code change
  3. User can declare `orchestrator: claude_code`, `reviewer: gemini_cli` (and other cao-supported providers) in a config file and the wrapper respects those mappings
  4. Config uses cao's native workflow format wherever applicable — no parallel wrapper DSL is invented
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Wave 0 test scaffold: update setup.test.ts stale assertion, create config.test.ts and alias.test.ts as failing stubs
- [ ] 02-02-PLAN.md — Core implementation: src/config/wrapper-config.ts and src/commands/alias.ts
- [ ] 02-03-PLAN.md — Wire everything: update src/cli.ts dynamic dispatch, fix setup.ts comment (D-07), scaffold .wrapper.json, create committed .wrapper.json
- [ ] 02-04-PLAN.md — Build, run full test suite, and smoke-test alias dispatch on real machine

### Phase 3: Plan→Review Orchestration Loop
**Goal**: Users can run a structured plan→review workflow where two AI CLIs iterate until the reviewer approves or the iteration limit is reached
**Depends on**: Phase 2
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04
**Success Criteria** (what must be TRUE):
  1. User can invoke a plan→review workflow and watch CLI A generate a plan, CLI B review it, and the loop repeat
  2. The loop terminates when the reviewer CLI emits an approval signal or when the configured max iteration count is hit
  3. Plan output is written to a file; the reviewer CLI reads from that file — no direct inter-process signaling
  4. User can specify planner and reviewer CLI roles per workflow invocation via a flag or config entry
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Environment Setup | 2/2 | Complete    | 2026-03-24 |
| 2. CLI Aliases + Workflow Config | 0/4 | Not started | - |
| 3. Plan→Review Orchestration Loop | 0/TBD | Not started | - |
