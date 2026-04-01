---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Wrapper Command Consolidation
status: v1.1 shipped
stopped_at: Milestone archived and tagged locally
last_updated: "2026-04-01T08:55:00+09:00"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 17
  completed_plans: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** Any machine, one command, same AI CLI orchestration environment instantly restored
**Current focus:** Plan the v1.2 documentation and architecture cleanup milestone

## Current Position

Milestone: v1.1 — SHIPPED
Next step: `$gsd-new-milestone`

## Performance Metrics

- Shipped milestones: 2
- Historical completed phases: 5
- Historical completed plans: 17
- Active milestone phases: 0
- Active milestone plans: 0

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1.0 | 3/3 | 10/10 | Shipped |
| v1.1 | 2/2 | 7/7 | Shipped |
| Phase 04 P01 | 5min | 2 tasks | 6 files |
| Phase 04 P02 | 5min | 2 tasks | 4 files |
| Phase 05 P01 | 15m | 2 tasks | 1 files |
| Phase 05-wrapper-runtime-contract P02 | 15m | 3 tasks | 10 files |
| Phase 05-wrapper-runtime-contract P04 | 25m | 3 tasks | 7 files |
| Phase 04 P03 | 5min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.0]: Treat workflow artifacts on disk as the authoritative completion signal for live runs.
- [v1.1 discuss]: Replace `wrapper` with `aco` as the canonical CLI command and remove legacy command-surface retention.
- [v1.1 roadmap]: Defer guide / architecture cleanup to v1.2 and keep workspace/runtime expansion queued for v1.3.
- [Phase 04]: Centralized public command strings in src/cli-surface.ts so help, version, and unknown-command output reuse one source of truth.
- [Phase 04]: Displayed CLI version now reads package.json at runtime to eliminate help/version drift during the aco cutover.
- [Phase 04]: Rejected wrapper as a compatibility alias and fail fast only when the invoked executable basename is wrapper.
- [Phase 04]: Reuse cli-surface recovery helpers so aco help/setup remediation stays centralized.
- [Phase 04]: Keep .wrapper.json and related runtime-contract identifiers deferred to Phase 05.
- [Phase 05]: [D-05] Remove all wrapper.lock references from core planning docs as it's out of scope for v1.1.
- [Phase 05-wrapper-runtime-contract]: [D-03] Branding Alignment: Renamed internal configuration to AcoConfig
- [Phase 05-wrapper-runtime-contract]: [D-04] Contract Preservation: Kept .wrapper.json as on-disk config filename
- [Phase 05-wrapper-runtime-contract]: [D-06] Prefer 'ACO_CAO_BASE_URL' with fallback to 'WRAPPER_CAO_BASE_URL' for branding transition
- [Phase 05-wrapper-runtime-contract]: [D-07] Added '_comment' field to '.wrapper.json' for branding during setup
- [Phase 05-wrapper-runtime-contract]: [D-08] Protect built-in command names from alias overrides
- [Phase 04]: Treat stale wrapper shims as package-owned only when their resolved targets match this package's dist/cli.js or the canonical aco shim target.
- [Phase 04]: Expose cleanup:legacy-bin as the single refresh path and reuse the same script from postinstall without reintroducing wrapper in package metadata.
- [Milestone v1.1]: Reserved alias names are inert and must never block built-in `aco` commands.

### Pending Todos

Define fresh v1.2 requirements and roadmap.

### Blockers/Concerns

No shipping blockers. Remaining concerns are documentation drift and partial validation hygiene noted in the milestone audit.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260401-omk | worktree에 새로운 브랜치 생성해서 진행해 | 2026-04-01 | b5be440 | | [260401-omk-worktree](.planning/quick/260401-omk-worktree/) |
| 260401-owm | Blueprint Step 1: cao 의존성 및 workflow 명령 구조적 제거 | 2026-04-01 | ccf6b36 | | [260401-owm-blueprint-step-1-cao-workflow](.planning/quick/260401-owm-blueprint-step-1-cao-workflow/) |
| 260401-wi8 | Blueprint Step 2: 새 config 스키마 + CliAdapter interface 정의 | 2026-04-01 | 88e219d | Verified | [260401-wi8-blueprint-step-2-config-cliadapter-inter](.planning/quick/260401-wi8-blueprint-step-2-config-cliadapter-inter/) |

## Session Continuity

Last activity: 2026-04-01 - Completed quick task 260401-wi8: Blueprint Step 2 V2Config + CliAdapter interface definitions
Last session: 2026-04-01T09:10:00+09:00
Stopped at: Quick task 260401-wi8 complete
Resume file: None
Next command: `$gsd-new-milestone`
