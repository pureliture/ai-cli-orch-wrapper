# Requirements: ai-cli-orch-wrapper

**Defined:** 2026-03-31
**Core Value:** 어느 PC로 옮겨도 단일 명령어 하나로 동일한 AI CLI 오케스트레이션 환경이 즉시 복원되어야 한다.

## v1 Requirements

### Workspace Isolation

- [ ] **WORK-01**: User can create an isolated workmux/worktree workspace for a target repository with one `wrapper` command
- [ ] **WORK-02**: User can inspect or reopen an existing isolated workspace without re-creating it manually
- [ ] **WORK-03**: User can run wrapper aliases and workflows inside the isolated workspace without mutating the base checkout
- [ ] **WORK-04**: User can clean up an isolated workspace and its related workmux/tmux resources with one `wrapper` command

### Workflow Expansion

- [ ] **FLOW-01**: User can select from multiple named inter-CLI workflow templates declared in repo-local config
- [ ] **FLOW-02**: User can define reviewer outcomes beyond `approved` and `changes_requested` without editing source code
- [ ] **FLOW-03**: User can rerun a workflow from the latest iteration context instead of restarting from iteration 1
- [ ] **FLOW-04**: User can see clear CLI guidance describing why a workflow stopped and what to do next

### Session Ergonomics

- [ ] **SESS-01**: User can run a provider preflight check that surfaces readiness issues before starting a long workflow
- [ ] **SESS-02**: User receives actionable remediation guidance when CAO/provider session bootstrap fails or stalls
- [ ] **SESS-03**: User can opt into a lightweight warmup/bootstrap flow that reduces first-run prompt friction for supported providers

## v2 Requirements

### Operations

- **OPER-01**: User can generate milestone audit artifacts automatically before release
- **OPER-02**: User can run a guided release flow for the wrapper itself

### Session Ergonomics

- **SESS-04**: Wrapper can persist provider readiness hints across machines without coupling to provider-specific state

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic installation of `cao`, `tmux`, or `workmux` | Wrapper still assumes these tools are preinstalled |
| Registry/profile management coupling | Remains intentionally separate from registry-hub and profile registry work |
| Full release automation in v1.1 | Keep this milestone focused on runtime workspace and workflow UX |
| `cmux` integration | Still outside the wrapper scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WORK-01 | TBD | Pending |
| WORK-02 | TBD | Pending |
| WORK-03 | TBD | Pending |
| WORK-04 | TBD | Pending |
| FLOW-01 | TBD | Pending |
| FLOW-02 | TBD | Pending |
| FLOW-03 | TBD | Pending |
| FLOW-04 | TBD | Pending |
| SESS-01 | TBD | Pending |
| SESS-02 | TBD | Pending |
| SESS-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after milestone definition*
