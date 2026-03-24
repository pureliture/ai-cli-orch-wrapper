# Architecture Research

**Domain:** AI CLI Orchestration Wrapper — portable multi-agent developer environment
**Researched:** 2026-03-24
**Confidence:** HIGH (cao official docs + workmux docs + tmux programmatic control patterns)

---

## Recommended Architecture

### Pattern: Layered CLI Wrapper

```
┌─────────────────────────────────────────────────────────────┐
│                    wrapper CLI (entry point)                  │
│   setup | start | stop | profile install | workflow run      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│  Setup Layer  │ │Profile Layer │ │    Workflow Engine        │
│  tmux conf   │ │ download     │ │  role mapping + launch   │
│  merge +     │ │ lockfile     │ │  inter-CLI handoff       │
│  idempotency │ │ verify       │ │  plan→review loops       │
└──────────────┘ └──────────────┘ └──────────┬───────────────┘
                                              │
                               ┌──────────────┼──────────────┐
                               ▼              ▼              ▼
                        ┌──────────┐  ┌──────────┐  ┌──────────────┐
                        │   cao    │  │   tmux   │  │   workmux    │
                        │ adapter  │  │ session  │  │  worktree    │
                        │          │  │ manager  │  │  lifecycle   │
                        └──────────┘  └──────────┘  └──────────────┘
                               │              │
                    ┌──────────┴──────────────┘
                    ▼
           ┌─────────────────────────────────────┐
           │  AI CLI Processes (in tmux panes)    │
           │  Claude Code | Gemini CLI | Codex    │
           │  Copilot CLI | ...                   │
           └─────────────────────────────────────┘
```

---

## Component Boundaries

### 1. wrapper CLI (entry point)
- **Responsibility**: Argument parsing, command routing, error handling
- **Inputs**: `process.argv`, environment variables, config file
- **Outputs**: Delegates to layer below, exits with code 0/1
- **Key files**: `src/cli.ts`, `src/index.ts`
- **Does NOT**: Touch tmux directly, know about cao internals

### 2. Setup Layer
- **Responsibility**: Idempotent environment bootstrap
- **Inputs**: `~/.config/tmux/ai-cli.conf` existence check, existing `~/.tmux.conf`
- **Outputs**: `~/.config/tmux/ai-cli.conf` written, source line injected once
- **Key operations**:
  - Guard: check if source line already in `~/.tmux.conf` before adding
  - Write wrapper-specific tmux settings to `ai-cli.conf` only
  - Download profiles from configured registry URL (delegates to Profile Layer)
- **Idempotency rule**: Every write operation must be preceded by existence check

### 3. Profile Layer
- **Responsibility**: cao profile download, lockfile management
- **Inputs**: Registry URL (from config, not hardcoded), profile identifiers
- **Outputs**: Profile files on disk, `wrapper.lock` updated
- **Key operations**:
  - `fetch(url)` — download profile MD file
  - Atomic lockfile write (write to temp, rename)
  - Hash verification at install time
- **Does NOT**: Know about tmux, workflows, or cao internals

### 4. Workflow Engine
- **Responsibility**: Orchestrate multi-CLI workflows
- **Inputs**: Workflow definition files (YAML or Markdown), CLI role assignments
- **Outputs**: tmux sessions created, CLI processes launched, handoff messages routed
- **Key operations**:
  - Parse workflow definition → resolve role→CLI mapping
  - Launch tmux sessions via tmux adapter
  - Route messages between CLIs (stdin relay or file-based handoff)
  - Detect completion signals, trigger next step in loop
- **Does NOT**: Directly spawn AI CLIs (delegates to cao adapter or tmux session manager)

### 5. cao Adapter
- **Responsibility**: Interface with cao (AWS Labs CLI Agent Orchestrator)
- **Inputs**: cao profile path, workflow step definition
- **Outputs**: cao process spawned in correct tmux pane
- **Key operations**:
  - Construct cao invocation from workflow role config
  - Map wrapper workflow concepts to cao handoff/assign patterns
- **Does NOT**: Know about worktrees or tmux layout decisions

### 6. tmux Session Manager
- **Responsibility**: Create/destroy tmux sessions and panes for AI CLI processes
- **Inputs**: Session layout spec (from Workflow Engine)
- **Outputs**: Named tmux sessions with windows/panes for each CLI role
- **Key operations**:
  - `tmux new-session -d -s <name>` — create detached session
  - `tmux new-window -t <session>` — add window per CLI role
  - `tmux send-keys -t <target> "<command>" Enter` — launch CLI
  - Update window name with agent status
- **Does NOT**: Know about workflow logic or inter-CLI message routing

### 7. workmux Bridge
- **Responsibility**: Worktree lifecycle management on demand
- **Inputs**: Task name, base branch
- **Outputs**: git worktree created, workmux session started, cleanup on demand
- **Key operations**:
  - `workmux start <task>` — create isolated worktree + tmux session
  - `workmux stop <task>` — cleanup worktree
- **Does NOT**: Interact with AI CLIs directly — sets up the environment only

---

## Data Flow

### Setup Flow
```
wrapper setup
  → Setup Layer: check ~/.config/tmux/ai-cli.conf exists?
      → No: write ai-cli.conf, inject source line into ~/.tmux.conf
      → Yes: no-op (idempotent)
  → Profile Layer: read registry URL from config
      → fetch profile from URL
      → verify hash
      → write to local path
      → update wrapper.lock atomically
```

### Workflow Launch Flow
```
wrapper start <workflow-name>
  → Workflow Engine: load workflow definition YAML
      → resolve role → CLI mapping (orchestrator=claude, reviewer=gemini)
      → tmux Session Manager: create session layout
          → new-session, new-window per role, send-keys to launch CLI
      → cao Adapter: configure cao with profile for orchestrator role
          → cao spawned in orchestrator pane
  → Workflow running: inter-CLI handoff via cao handoff/assign
```

### Plan→Review Loop Flow
```
wrapper workflow plan-review
  → Workflow Engine: load plan-review workflow definition
  → Launch: A-CLI in planner pane, B-CLI in reviewer pane
  → Step 1: A-CLI runs, writes plan to shared output file / stdout
  → Step 2: Workflow Engine detects completion signal from A-CLI
  → Step 3: Route plan output as input to B-CLI (file pass or stdin relay)
  → Step 4: B-CLI runs review, writes feedback
  → Step 5: Workflow Engine detects completion from B-CLI
  → Step 6: Route feedback back to A-CLI
  → Repeat until: B-CLI emits APPROVED signal or max iterations reached
```

### Profile Download Flow
```
wrapper profile install <identifier>
  → Profile Layer: read registry URL from config
  → fetch URL → download MD file
  → compute SHA256 hash
  → write to ~/.config/ai-cli/profiles/<identifier>.md
  → update wrapper.lock: { identifier, url, localPath, hash, installedAt }
```

---

## Suggested Build Order

Dependencies determine order — each layer depends on those below it.

### Phase 1: Foundation
1. **CLI skeleton** — argument parsing (`node:util parseArgs`), command routing, version from package.json
2. **Config system** — read `~/.config/ai-cli/config.json` (registry URL, default roles)
3. **Profile Layer** — download + atomic lockfile (HTTPS-only, hash verification)

*Why first: No dependencies. Validates the core portability mechanism.*

### Phase 2: Environment Setup
4. **Setup Layer** — `wrapper setup` command, idempotent tmux conf merge, profile install trigger

*Why second: Depends on Profile Layer and config system. Delivers the "single command" core value.*

### Phase 3: tmux Integration
5. **tmux Session Manager** — session/window/pane creation, send-keys, window title updates

*Why third: Workflow Engine depends on this. Most complex subsystem — isolate it.*

### Phase 4: cao Integration + Simple Workflows
6. **cao Adapter** — configure and spawn cao in tmux pane with correct profile
7. **Workflow Engine (basic)** — role mapping from YAML, launch sessions, linear workflows

*Why fourth: Depends on tmux Session Manager and cao Adapter. Delivers first end-to-end workflow.*

### Phase 5: Advanced Workflows
8. **Inter-CLI message passing** — file-based handoff, completion signal detection
9. **Plan→Review loop** — loop logic, exit conditions, iteration limits
10. **workmux Bridge** — worktree lifecycle (on demand, not required for basic workflows)

*Why last: Highest complexity. Build on stable foundation.*

---

## Key Architectural Decisions

### Config File Location
- `~/.config/ai-cli/config.json` — user-level, survives repo clones
- `wrapper.lock` — repo-resident, travels with the environment (committed)
- `~/.config/tmux/ai-cli.conf` — tmux conf, managed by setup layer

### Workflow Definition Format
- **Recommendation**: YAML files in `~/.config/ai-cli/workflows/` or `.ai-cli/workflows/` in repo
- Reason: Data-driven, no source changes needed for new workflows
- Example structure:
  ```yaml
  name: plan-review
  roles:
    orchestrator: claude
    reviewer: gemini
  steps:
    - role: orchestrator
      action: plan
      output: plan.md
    - role: reviewer
      input: plan.md
      action: review
      output: feedback.md
      completion_signal: "APPROVED"
    - role: orchestrator
      input: feedback.md
      action: revise
      output: plan.md
  loop:
    until: reviewer.completion_signal == "APPROVED"
    max_iterations: 5
  ```

### Inter-CLI Communication
- **Recommendation**: File-based handoff (write output to temp file, next CLI reads it)
- Reason: Most reliable across different CLI stdout conventions; avoids pipe fragility
- Alternative (future): cao's native MCP tool-call handoff if available

### tmux Conf Strategy
- **NEVER** write to `~/.tmux.conf` directly
- `~/.config/tmux/ai-cli.conf` is the only file this wrapper owns
- One `source-file ~/.config/tmux/ai-cli.conf` line injected into `~/.tmux.conf` (guarded, idempotent)

---

## What NOT to Build

- **Custom CLI process manager**: Use tmux send-keys and existing CLI process lifecycle — don't build a supervisor
- **Real-time streaming message bus**: Use file-based handoff — streaming amplifies errors and causes loops
- **TUI/dashboard**: tmux panes and window names ARE the UI
- **Plugin system**: Workflow YAML files are the extension mechanism — no plugin API needed for v1

---

*Architecture research for: AI CLI orchestration wrapper*
*Researched: 2026-03-24*
