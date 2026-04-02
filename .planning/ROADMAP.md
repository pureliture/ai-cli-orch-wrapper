# Roadmap: ai-cli-orch-wrapper

## Milestones

- ✅ **v1.0 Core Wrapper Foundation** - Phases 01-03 shipped 2026-03-25 ([roadmap archive](./milestones/v1.0-ROADMAP.md), [requirements archive](./milestones/v1.0-REQUIREMENTS.md), [audit](./milestones/v1.0-MILESTONE-AUDIT.md))
- ✅ **v1.1 Wrapper Command Consolidation** - Phases 04-05 shipped 2026-03-31 ([roadmap archive](./milestones/v1.1-ROADMAP.md), [requirements archive](./milestones/v1.1-REQUIREMENTS.md), [audit](./milestones/v1.1-MILESTONE-AUDIT.md))
- 🚧 **v1.2 CC Slash Commands — Multi-AI Bridge** - Phases 06-08 (in progress)
- 📋 **v1.3 Isolated Workspaces + Workflow Ergonomics** - Planned

## Phases

<details>
<summary>✅ v1.0 Core Wrapper Foundation (Phases 01-03) - SHIPPED 2026-03-25</summary>

See [milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.1 Wrapper Command Consolidation (Phases 04-05) - SHIPPED 2026-03-31</summary>

See [milestones/v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md) for full phase details.

</details>

### 🚧 v1.2 CC Slash Commands — Multi-AI Bridge (In Progress)

**Milestone Goal:** Claude Code 슬래시 커맨드로 Gemini CLI / Copilot CLI를 서브에이전트로 실행하는 브릿지 레이어 구축. 결과물은 `.claude/commands/aco/` 슬래시 커맨드.

- [ ] **Phase 6: Adapter Infrastructure** - Shared bash helpers + routing config schema for spawning external AI CLIs as subagents
- [ ] **Phase 7: /aco:review + /aco:status** - Review delegation and adapter status commands
- [ ] **Phase 8: /aco:adversarial** - Adversarial review command with focus control

## Phase Details

### Phase 6: Adapter Infrastructure
**Goal**: Users can spawn Gemini-CLI and Copilot-CLI as subagents from Claude Code, with routing config controlling which adapter handles each command
**Depends on**: Phase 5 (v1.1 complete)
**Requirements**: ADPT-01, ADPT-02, ADPT-03, ADPT-04
**Success Criteria** (what must be TRUE):
  1. Typing `/aco:review` routes the diff to Gemini-CLI and returns a response collected from its stdout
  2. Typing `/aco:review` routes the diff to Copilot-CLI and returns a response collected from its stdout
  3. When an adapter CLI is not installed, the command prints a clear error naming the missing tool
  4. A `.wrapper.json` v2.0 `routing` block (`routing.review`, `routing.adversarial`) controls which adapter each command uses
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — Directory structure + Wave 0 bash test scaffolding (RED stubs)
- [x] 06-02-PLAN.md — adapter.sh core functions (aco_adapter_available, aco_adapter_version, aco_check_adapter, aco_adapter_invoke)
- [x] 06-03-PLAN.md — .wrapper.json v2.0 routing schema + _read_routing_adapter helper

### Phase 7: /aco:review + /aco:status
**Goal**: Users can delegate code review to a configured adapter CLI and inspect adapter availability and routing config at a glance
**Depends on**: Phase 6
**Requirements**: REV-01, REV-02, REV-03, REV-04, STAT-01, STAT-02, STAT-03
**Success Criteria** (what must be TRUE):
  1. `/aco:review` with no arguments sends `git diff HEAD` output to the routing config's review adapter
  2. `/aco:review path/to/file.ts` sends that file's content as the review target instead of the diff
  3. When `git diff HEAD` is empty, `/aco:review` retries with `git diff HEAD~1`; when both are empty it prints "No changes detected"
  4. `/aco:review --target gemini` overrides the routing config and sends to Gemini-CLI regardless of config
  5. `/aco:status` prints a `✓ / ✗` availability table for all configured adapters and shows the current command-to-adapter routing table
  6. `/aco:status` when `.wrapper.json` is missing prints "Run /aco:init first"
**Plans**: TBD

### Phase 8: /aco:adversarial
**Goal**: Users can run an aggressive, focus-targeted review of their code against any configured adapter CLI
**Depends on**: Phase 7
**Requirements**: ADV-01, ADV-02, ADV-03, ADV-04
**Success Criteria** (what must be TRUE):
  1. `/aco:adversarial` dispatches to the routing config's adversarial adapter using a more aggressive prompt than `/aco:review`
  2. `/aco:adversarial --focus security` scopes the review prompt to security concerns; `--focus performance`, `--focus correctness`, and `--focus all` each change the prompt focus accordingly
  3. Input resolution follows the same priority as `/aco:review`: explicit file path beats `git diff HEAD`, fallback to `git diff HEAD~1`, then "No changes detected" error
  4. `/aco:adversarial --target copilot` overrides the routing config's adversarial adapter
**Plans**: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-25 |
| 2. CLI Aliases + Workflow Config | v1.0 | 4/4 | Complete | 2026-03-25 |
| 3. Plan→Review Orchestration Loop | v1.0 | 3/3 | Complete | 2026-03-25 |
| 4. Canonical Command Surface | v1.1 | 3/3 | Complete | 2026-03-31 |
| 5. Wrapper Runtime Contract | v1.1 | 4/4 | Complete | 2026-03-31 |
| 6. Adapter Infrastructure | v1.2 | 0/3 | Not started | - |
| 7. /aco:review + /aco:status | v1.2 | 0/TBD | Not started | - |
| 8. /aco:adversarial | v1.2 | 0/TBD | Not started | - |
