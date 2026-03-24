# Requirements: ai-cli-orch-wrapper

**Defined:** 2026-03-24
**Core Value:** 어느 PC로 옮겨도 단일 명령어 하나로 동일한 AI CLI 오케스트레이션 환경이 즉시 복원되어야 한다.

---

## v1 Requirements

### Setup

- [ ] **SETUP-01**: User can run `wrapper setup` to bootstrap the full environment with a single command
- [ ] **SETUP-02**: `wrapper setup` is idempotent — safe to re-run on an already-configured machine without side effects
- [ ] **SETUP-03**: `wrapper setup` checks for required prerequisites (cao, tmux, workmux) and exits with a clear, actionable error message if any are missing
- [ ] **SETUP-04**: `wrapper setup` writes `~/.config/tmux/ai-cli.conf` and injects exactly one `source-file` line into `~/.tmux.conf` (never overwrites `~/.tmux.conf` directly)

### CLI Aliases

- [ ] **ALIAS-01**: User can invoke AI CLIs via short wrapper aliases (e.g., `wrapper claude`, `wrapper gemini`) that map to the appropriate `cao` invocation
- [ ] **ALIAS-02**: Alias-to-CLI mappings are configurable (not hardcoded in source) so users can add or remap aliases without code changes

### Plan→Review Loop (cao gap)

- [ ] **ORCH-01**: User can run a plan→review workflow where CLI A generates a plan, CLI B reviews it, and the loop repeats until B approves or max iterations is reached
- [ ] **ORCH-02**: The plan→review loop has a configurable exit condition: explicit approval signal from reviewer CLI and/or configurable max iteration count
- [ ] **ORCH-03**: Inter-CLI handoff uses file-based message passing (plan output written to file, reviewer reads from file)
- [ ] **ORCH-04**: User can specify which CLI plays which role (planner, reviewer) per workflow invocation via config or flag

### Workflow Config

- [ ] **CONFIG-01**: User can declare role→CLI mappings in a config file (e.g., `orchestrator: claude_code`, `reviewer: gemini_cli`)
- [ ] **CONFIG-02**: Config supports all cao-supported AI CLI providers (claude_code, gemini_cli, codex, copilot_cli, and others cao adds over time)
- [ ] **CONFIG-03**: Workflow definitions use cao's native format wherever possible — wrapper does not invent a parallel workflow DSL

---

## v2 Requirements

### workmux Integration

- **WORK-01**: User can trigger a worktree-based isolated task environment via `wrapper worktree start <task>`
- **WORK-02**: User can clean up a worktree environment via `wrapper worktree stop <task>`

### Extended Workflow Features

- **EXT-01**: Wrapper surfaces additional inter-CLI communication patterns not covered by cao as new workflows are identified through v1 usage

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| cao profile management (download, lockfile) | Not wrapper's responsibility — users manage profiles independently |
| tmux session launch | cao handles this natively — wrapper does not duplicate |
| Workflow definition editor / viewer | Use cao's native tooling directly |
| Installing cao / tmux / workmux | Prerequisites must be installed before running `wrapper setup` |
| ghostty / oh-my-zsh configuration | Owned by ghostty-tmux-wrapping project |
| cmux integration | Out of scope for this project |
| Registry-hub implementation | Separate parallel project; wrapper only consumes URLs if needed |
| Real-time inter-CLI streaming bus | Fragile; file-based handoff is sufficient and safer |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 1 | Pending |
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| ALIAS-01 | Phase 2 | Pending |
| ALIAS-02 | Phase 2 | Pending |
| CONFIG-01 | Phase 2 | Pending |
| CONFIG-02 | Phase 2 | Pending |
| CONFIG-03 | Phase 2 | Pending |
| ORCH-01 | Phase 3 | Pending |
| ORCH-02 | Phase 3 | Pending |
| ORCH-03 | Phase 3 | Pending |
| ORCH-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
