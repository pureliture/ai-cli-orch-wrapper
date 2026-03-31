# Requirements: ai-cli-orch-wrapper

**Defined:** 2026-03-31
**Core Value:** 어느 PC로 옮겨도 단일 명령어 하나로 동일한 AI CLI 오케스트레이션 환경이 즉시 복원되어야 한다.

## v1 Requirements

### Canonical Command

- [x] **CMD-01**: User can invoke the installed CLI through the canonical `aco` command on a supported machine
- [x] **CMD-02**: User sees `aco` in help, usage, version, and command error output instead of legacy command labels
- [ ] **CMD-03**: User can rely on built-in subcommands continuing to override alias names after the `aco` command surface is consolidated

### Wrapper Runtime Contract

- [x] **WRAP-01**: User can run `aco setup` and get repo-local config initialized through the `.wrapper.json` contract without manual renaming
- [x] **WRAP-02**: User can run alias and workflow entrypoints through `aco` while artifacts continue to be stored under the expected `.wrapper/` paths
- [x] **WRAP-03**: User receives direct remediation telling them to use `aco` when they hit a stale command invocation or packaging assumption

## Future Requirements

### Documentation Hygiene (v1.2)

- **DOC-01**: User can find the current install and command entrypoints in README without conflicting legacy guidance
- **DOC-02**: Maintainer can trace the wrapper architecture, config files, and workflow lifecycle from repository docs without reverse-engineering the codebase
- **DOC-03**: Planning docs, architecture notes, and user guides stay aligned with the shipped CLI surface

### Future Runtime Expansion (v1.3)

- **WORK-01**: User can create an isolated workmux/worktree workspace for a target repository with one `wrapper` command
- **WORK-02**: User can inspect or reopen an existing isolated workspace without re-creating it manually
- **WORK-03**: User can run wrapper aliases and workflows inside the isolated workspace without mutating the base checkout
- **WORK-04**: User can clean up an isolated workspace and its related workmux/tmux resources with one `wrapper` command
- **FLOW-01**: User can select from multiple named inter-CLI workflow templates declared in repo-local config
- **FLOW-02**: User can define reviewer outcomes beyond `approved` and `changes_requested` without editing source code
- **FLOW-03**: User can rerun a workflow from the latest iteration context instead of restarting from iteration 1
- **FLOW-04**: User can see clear CLI guidance describing why a workflow stopped and what to do next
- **SESS-01**: User can run a provider preflight check that surfaces readiness issues before starting a long workflow
- **SESS-02**: User receives actionable remediation guidance when CAO/provider session bootstrap fails or stalls
- **SESS-03**: User can opt into a lightweight warmup/bootstrap flow that reduces first-run prompt friction for supported providers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic installation of `cao`, `tmux`, or `workmux` | Wrapper still assumes these tools are preinstalled |
| Broad guide / architecture rewrite in v1.1 | Reserved for the follow-up documentation milestone |
| Workspace isolation and workflow expansion in v1.1 | Explicitly deferred to the pre-scoped v1.3 milestone |
| Registry/profile management coupling | Remains intentionally separate from registry-hub and profile registry work |
| `cmux` integration | Still outside the wrapper scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMD-01 | Phase 04 | Complete |
| CMD-02 | Phase 04 | Complete |
| WRAP-03 | Phase 04 | Complete |
| CMD-03 | Phase 05 | Pending |
| WRAP-01 | Phase 05 | Complete |
| WRAP-02 | Phase 05 | Complete |

**Coverage:**
- v1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0
- Phase 04: 3 requirements
- Phase 05: 3 requirements

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after v1.1 roadmap reset*
