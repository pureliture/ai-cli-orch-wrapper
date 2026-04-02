# Roadmap: ai-cli-orch-wrapper

## Milestones

- ✅ **v1.0 Core Wrapper Foundation** - Phases 01-03 shipped 2026-03-25 ([roadmap archive](./milestones/v1.0-ROADMAP.md), [requirements archive](./milestones/v1.0-REQUIREMENTS.md), [audit](./milestones/v1.0-MILESTONE-AUDIT.md))
- ✅ **v1.1 Wrapper Command Consolidation** - Phases 04-05 shipped 2026-03-31 ([roadmap archive](./milestones/v1.1-ROADMAP.md), [requirements archive](./milestones/v1.1-REQUIREMENTS.md), [audit](./milestones/v1.1-MILESTONE-AUDIT.md))
- 🚧 **v1.2 CC Slash Commands — Multi-AI Bridge** - Phases 06-08 (in progress)
  - 결과물: `.claude/commands/gemini/` + `.claude/commands/copilot/` 슬래시 커맨드 세트
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

**Milestone Goal:** Claude Code 슬래시 커맨드로 Gemini CLI / Copilot CLI를 서브에이전트로 실행하는 브릿지 레이어 구축. 커맨드 네임스페이스가 타겟 CLI를 직접 인코딩 (`/gemini:*`, `/copilot:*`) — config 파일 라우팅 없이 호출부터 명시적.

- ✅ **Phase 6: Adapter Infrastructure** - Shared bash helpers + adapter availability detection
- [ ] **Phase 7: /gemini:review + /copilot:review + status** - Per-CLI review delegation and availability commands
- [ ] **Phase 8: /gemini:adversarial + /copilot:adversarial** - Per-CLI adversarial review with focus control

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

### Phase 7: /gemini:review + /copilot:review + status commands
**Goal**: Users can delegate code review to Gemini CLI or Copilot CLI by name, and inspect each adapter's availability directly
**Depends on**: Phase 6
**Requirements**: REV-01, REV-02, REV-03, REV-04, STAT-01, STAT-02
**Success Criteria** (what must be TRUE):
  1. `/gemini:review` with no arguments sends `git diff HEAD` to Gemini CLI and returns its response verbatim
  2. `/copilot:review` with no arguments sends `git diff HEAD` to Copilot CLI and returns its response verbatim
  3. `/gemini:review path/to/file.ts` and `/copilot:review path/to/file.ts` each send that file's content as the review target instead of the diff
  4. When the target CLI is not installed, the command prints a clear error naming the missing tool (e.g. "gemini not found — install with: pip install google-generativeai-cli")
  5. When `git diff HEAD` is empty, retries with `git diff HEAD~1`; when both are empty prints "No changes detected"
  6. `/gemini:status` prints Gemini CLI availability + version; `/copilot:status` prints Copilot CLI availability + version
**Plans**: TBD

### Phase 8: /gemini:adversarial + /copilot:adversarial
**Goal**: Users can run an aggressive, focus-targeted review via either CLI
**Depends on**: Phase 7
**Requirements**: ADV-01, ADV-02, ADV-03, ADV-04
**Success Criteria** (what must be TRUE):
  1. `/gemini:adversarial` and `/copilot:adversarial` each use a more aggressive review prompt than their `:review` counterparts
  2. `--focus security` scopes the review to security concerns; `--focus performance`, `--focus correctness`, and `--focus all` each change the prompt focus accordingly
  3. Input resolution follows the same priority as `:review`: explicit file path beats `git diff HEAD`, fallback to `git diff HEAD~1`, then "No changes detected" error
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
| 6. Adapter Infrastructure | v1.2 | 3/3 | Complete | 2026-04-02 |
| 7. /gemini:review + /copilot:review | v1.2 | 0/TBD | Not started | - |
| 8. /gemini:adversarial + /copilot:adversarial | v1.2 | 0/TBD | Not started | - |
