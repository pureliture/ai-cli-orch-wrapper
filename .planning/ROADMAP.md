# Roadmap: ai-cli-orch-wrapper

## Milestones

- ✅ **v1.0 Core Wrapper Foundation** - Phases 01-03 shipped 2026-03-25 ([roadmap archive](./milestones/v1.0-ROADMAP.md), [requirements archive](./milestones/v1.0-REQUIREMENTS.md), [audit](./milestones/v1.0-MILESTONE-AUDIT.md))
- ✅ **v1.1 Wrapper Command Consolidation** - Phases 04-05 shipped 2026-03-31 ([roadmap archive](./milestones/v1.1-ROADMAP.md), [requirements archive](./milestones/v1.1-REQUIREMENTS.md), [audit](./milestones/v1.1-MILESTONE-AUDIT.md))
- 🚧 **v1.2 CC Slash Commands — Multi-AI Bridge** - Phases 06-09 (in progress)
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
- [x] **Phase 7: review + status + setup** - Per-CLI review delegation, availability check, and initial setup
- [ ] **Phase 8: adversarial + rescue** - Adversarial review and stuck-state recovery per CLI
- [ ] **Phase 9: result + cancel** - Background task result retrieval and cancellation per CLI

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

### Phase 7: review + status + setup
**Goal**: Users can delegate code review to Gemini or Copilot CLI by name, check each adapter's availability, and run initial setup
**Depends on**: Phase 6
**Requirements**: REV-01, REV-02, REV-03, STAT-01, STAT-02, SETUP-01
**Success Criteria** (what must be TRUE):
  1. `/gemini:review` and `/copilot:review` each send `git diff HEAD` to their respective CLI and return the response verbatim
  2. `/gemini:review path/to/file.ts` and `/copilot:review path/to/file.ts` each send that file's content as the review target
  3. When the target CLI is not installed, the command prints a clear error naming the missing tool and install hint
  4. When `git diff HEAD` is empty, retries with `git diff HEAD~1`; when both are empty prints "No changes detected"
  5. `/gemini:status` and `/copilot:status` each print the CLI's availability (`✓`/`✗`) and version
  6. `/gemini:setup` and `/copilot:setup` each print install instructions and required auth steps for their CLI
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Scaffolding + reviewer prompts + Wave 0 test stubs + .wrapper.json routing fix
- [x] 07-02-PLAN.md — /gemini:review and /copilot:review commands (REV-01, REV-02, REV-03)
- [x] 07-03-PLAN.md — /gemini:status, /copilot:status, /gemini:setup, /copilot:setup commands (STAT-01, SETUP-01)

### Phase 8: adversarial + rescue
**Goal**: Users can run aggressive focus-targeted reviews and get unstuck via a second-opinion AI using either CLI
**Depends on**: Phase 7
**Requirements**: ADV-01, ADV-02, ADV-03, RESCUE-01, RESCUE-02
**Success Criteria** (what must be TRUE):
  1. `/gemini:adversarial` and `/copilot:adversarial` each use a more aggressive review prompt than their `:review` counterparts
  2. `--focus security`, `--focus performance`, `--focus correctness`, and `--focus all` each scope the adversarial prompt accordingly
  3. `/gemini:rescue` and `/copilot:rescue` each accept a problem description and return a fresh perspective / unblocking suggestions from their respective CLI
  4. Input resolution for `:adversarial` follows the same priority as `:review`: file path > `git diff HEAD` > `git diff HEAD~1` > "No changes detected"
**Plans**: TBD

### Phase 9: result + cancel
**Goal**: Users can run review/adversarial tasks in the background and retrieve or cancel them later
**Depends on**: Phase 8
**Requirements**: BG-01, BG-02, BG-03
**Success Criteria** (what must be TRUE):
  1. `/gemini:review --background` and `/copilot:review --background` each launch the review as a background task and immediately confirm the task ID
  2. `/gemini:result <task-id>` and `/copilot:result <task-id>` each retrieve and print the output of a completed background task
  3. `/gemini:cancel <task-id>` and `/copilot:cancel <task-id>` each cancel a running background task
  4. Running `:result` on an incomplete task prints "Still running — check again later"
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md — Scaffolding: background task helpers in adapter.sh + Wave 0 test stubs
- [ ] 09-02-PLAN.md — Commands: --background flag on review/adversarial + result and cancel commands

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
| 7. review + status + setup | v1.2 | 3/3 | ✅ Complete | 2026-04-02 |
| 8. adversarial + rescue | v1.2 | 3/3 | ✅ Verified | 2026-04-02 |
| 9. result + cancel (background) | v1.2 | 0/2 | Not started | - |
