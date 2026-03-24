# Feature Research

**Domain:** AI CLI Orchestration Wrapper — portable multi-agent developer environment
**Researched:** 2026-03-24
**Confidence:** MEDIUM-HIGH (CAO features from AWS blog + web search; workmux from official docs; inter-agent patterns from academic and community sources)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single-command environment setup | Core value prop: any PC, one command, same env | MEDIUM | Must cover tmux conf merge + cao profile install in one shot |
| Declarative workflow role mapping | Users expect to say "Claude is orchestrator, Gemini is reviewer" rather than configure tmux panes manually | MEDIUM | Maps CLI tool names to workflow roles (orchestrator, reviewer, planner, executor) |
| Support for all major AI CLIs | Claude Code, Gemini CLI, Codex, Copilot CLI are the de facto standard set in 2025–2026 | LOW | CAO already supports these as first-class providers; wrapper should not limit the set |
| tmux session management | Every comparable tool (CAO, NTM, workmux) uses tmux as the backbone; users expect this | HIGH | Requires non-invasive conf injection into `~/.config/tmux/ai-cli.conf`, never touching `~/.tmux.conf` directly |
| cao profile download from URL | Users expect registry-backed profiles; AGENTS.md / skill markdown is the standard format | LOW | Lockfile-based; registry URL is config, not hardcoded |
| Lockfile for installed profiles | Any package manager analogy — users expect reproducible installs across machines | MEDIUM | Lockfile must live in the repo so it travels with the environment |
| Non-invasive config management | Developer tools that clobber existing shell/tmux config are a dealbreaker | LOW | Source a single include file; never overwrite user config directly |
| Idempotent setup | Running setup twice on the same machine must not break anything | MEDIUM | All write operations must be additive / guard-checked |
| Help and version commands | Standard CLI UX expectation | LOW | Already partially present in existing `cli.ts` |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Workflow definition with plan→review loops | Structured critic-refine cycle (A plans → B reviews → A revises → B re-reviews) is powerful but nobody wires it up for you | HIGH | Needs inter-CLI message passing and loop termination condition; maps to CAO handoff/assign patterns |
| Cross-provider orchestration (heterogeneous agents) | Running Claude as orchestrator and Gemini as reviewer simultaneously is harder to set up than single-provider; this wrapper makes it trivial | HIGH | Must coordinate different auth models, different stdin/stdout conventions per CLI |
| worktree-based task isolation via workmux | Parallel agents on separate git worktrees without merge hell is the 2025–2026 "agentmaxxing" pattern; workmux automates this | MEDIUM | Only invoked on demand; wrapper orchestrates workmux lifecycle (create, monitor, cleanup) |
| Profile portability via repo-resident lockfile | Full env reproducibility: clone repo + one command = exact same agents and roles | MEDIUM | Lockfile pins profile URLs and content hashes; not just tool versions |
| Workflow extensibility (add custom workflows) | Users will want to define their own role topologies beyond the built-in ones | MEDIUM | Workflow definitions should be data (YAML or Markdown), not code; new workflows should not require source changes |
| tmux session status in window titles | Surfacing agent status (running, waiting, done) in tmux window names is a strong DX improvement; workmux does this for single-tool, wrapper extends it cross-provider | LOW | Read agent process stdout/exit state; update tmux window name |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Installing cao / tmux / workmux as part of setup | "One command should install everything" sounds appealing | Couples this wrapper's release cycle to upstream tool versions; breaks when upstream changes install method; creates a second package manager | Document prerequisites clearly; fail fast with a useful error message if prereqs are missing |
| Hardcoded registry-hub URL | Convenience — "just work" out of the box | Couples wrapper and registry-hub development cycles; breaks both projects when either changes | Registry URL is a configuration value (config file / env var); no default hardcoded in source |
| Auto-installing oh-my-zsh / ghostty config | Tempting to do "complete env setup" | Out of scope; that responsibility belongs to ghostty-tmux-wrapping project; doing it here creates ownership ambiguity and `~/.tmux.conf` conflicts | Scope boundary: this wrapper owns `~/.config/tmux/ai-cli.conf` only |
| Direct `~/.tmux.conf` modification | Users want seamless tmux integration | Clobbers the ghostty-tmux-wrapping project's conf; causes hard-to-debug conflicts on new machines | Inject a single `source-file` line at the end of the existing conf; all real config goes into `ai-cli.conf` |
| Real-time streaming inter-CLI message bus | "Agents should see each other's output live" sounds powerful | Amplifies errors up to 17x in unstructured networks (DeepMind 2025 study); causes looping and runaway token burn without exit conditions | Use structured handoff/assign patterns with explicit completion signals (CAO model); async message passing with defined entry/exit points |
| Global agent supervision without isolation | Single orchestrator managing all tasks in shared context | Context pollution: agents leak irrelevant information to each other; hard to debug; degrades output quality | Session-based isolation per worktree/pane with only necessary context shared (CAO pattern) |
| cmux integration | Might seem like natural pairing with tmux tooling | Out of scope for this milestone; adds maintenance surface with unclear benefit over workmux | Defer to future consideration; re-evaluate if clear use case emerges |
| Building a TUI / kanban UI | Some comparable tools (vibe-kanban) offer this | Adds significant complexity; the terminal IS the UI (workmux philosophy); tmux panes and window names are the interface | Lean on tmux native primitives — named windows, status line, popup dashboard if needed |

---

## Feature Dependencies

```
[Single-command setup]
    └──requires──> [Non-invasive tmux conf management]
    └──requires──> [cao profile download from URL]
                       └──requires──> [Lockfile for installed profiles]

[Workflow role mapping]
    └──requires──> [Single-command setup]
    └──requires──> [tmux session management]

[Plan→review loop workflow]
    └──requires──> [Workflow role mapping]
    └──requires──> [Inter-CLI message passing]
    └──requires──> [tmux session management]

[worktree-based isolation]
    └──requires──> [tmux session management]
    └──requires──> [Workflow role mapping]

[worktree cleanup]
    └──requires──> [worktree-based isolation]

[Workflow extensibility]
    └──enhances──> [Workflow role mapping]
    └──enhances──> [Plan→review loop workflow]

[tmux window status titles]
    └──enhances──> [tmux session management]
    └──enhances──> [worktree-based isolation]

[Profile portability via lockfile]
    └──enhances──> [Single-command setup]
    └──requires──> [cao profile download from URL]
```

### Dependency Notes

- **Single-command setup requires non-invasive tmux conf management:** The setup command writes `ai-cli.conf` and injects the source line; both must succeed atomically or setup must be rolled back cleanly.
- **Plan→review loop requires inter-CLI message passing:** Without a defined passing mechanism (file, stdin relay, or CAO MCP handoff), the loop cannot be implemented reliably. This is the highest-complexity feature and the last to be implemented.
- **Workflow extensibility enhances role mapping:** A fixed role set is fine for MVP; extensibility turns it into a platform. Must not be required for launch.
- **worktree isolation requires session management:** You cannot create an isolated worktree environment without first having tmux session lifecycle under control.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Single-command setup (`wrapper setup`) — installs `~/.config/tmux/ai-cli.conf`, injects source line, downloads profiles from configured registry URL, writes lockfile
- [ ] cao profile download + lockfile — fetch MD profiles from URL, write lockfile pinning URL + hash
- [ ] Declarative workflow role mapping — config file maps CLI names to roles (orchestrator, reviewer, executor) for at least one named workflow
- [ ] tmux session launch per workflow — `wrapper start <workflow>` opens tmux windows with named sessions, each running the correct CLI in the correct role
- [ ] Idempotent setup — re-running `wrapper setup` is safe on an already-configured machine
- [ ] Non-invasive tmux conf — `ai-cli.conf` approach with single source-file line injection

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] worktree-based isolation via workmux — trigger: user runs parallel tasks and hits merge conflicts or context pollution
- [ ] worktree cleanup command — trigger: worktrees accumulate and clutter the repo
- [ ] tmux window status titles reflecting agent state — trigger: users lose track of which agent is running
- [ ] Workflow extensibility (user-defined workflows in YAML/Markdown) — trigger: users want custom role topologies

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Plan→review inter-CLI loop with explicit handoff — defer because: highest complexity, requires robust message passing, and exit condition logic; validate simpler role mapping first
- [ ] Cross-provider heterogeneous orchestration hardening — defer because: auth model differences between CLIs require per-provider adapters; build one provider's adapter well before generalizing
- [ ] Profile registry search — defer because: registry-hub is under parallel development; integrate once that API stabilizes

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Single-command setup | HIGH | MEDIUM | P1 |
| Non-invasive tmux conf | HIGH | LOW | P1 |
| cao profile download + lockfile | HIGH | LOW | P1 |
| Workflow role mapping (config-driven) | HIGH | MEDIUM | P1 |
| tmux session launch per workflow | HIGH | HIGH | P1 |
| Idempotent setup | HIGH | MEDIUM | P1 |
| worktree isolation via workmux | MEDIUM | MEDIUM | P2 |
| worktree cleanup | MEDIUM | LOW | P2 |
| tmux window status titles | MEDIUM | LOW | P2 |
| Workflow extensibility | MEDIUM | MEDIUM | P2 |
| Plan→review inter-CLI loop | HIGH | HIGH | P3 |
| Cross-provider orchestration hardening | MEDIUM | HIGH | P3 |
| Profile registry search | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | CAO (AWS Labs) | NTM / workmux | Our Approach |
|---------|---------------|---------------|--------------|
| Multi-CLI support | claude_code, gemini_cli, codex, copilot_cli, kiro_cli, kimi_cli | claude, codex, gemini (any CLI as placeholder) | Same set; wrapper configures CAO, not a CAO replacement |
| Orchestration patterns | Handoff (sync), Assign (async), Send Message | N/A — tmux pane management only | Expose Handoff + Assign via workflow config; Send Message deferred |
| Agent profile format | Markdown files with system_prompt + mcpServers frontmatter | .workmux.yaml | cao Markdown profiles downloaded from registry URL; lockfile-tracked |
| Session isolation | tmux sessions per agent | git worktrees + tmux windows per task | tmux sessions (via CAO) + optional worktrees (via workmux) on demand |
| Portability / setup | Manual install + config | single-project .workmux.yaml | Repo-resident config + lockfile; `wrapper setup` reproduces full env on any machine |
| tmux conf management | Assumes tmux installed; no conf management | Assumes tmux; no conf management | Non-invasive: ai-cli.conf + single source-file line |
| Workflow scheduling | Cron-based flows (beta) | Not supported | Out of scope for v1; follow CAO's approach if added |
| Extensibility | REST API + MCP tools | .workmux.yaml templates | User-defined workflow files (v1.x); REST/MCP surface deferred |

---

## Sources

- [AWS Open Source Blog — Introducing CLI Agent Orchestrator](https://aws.amazon.com/blogs/opensource/introducing-cli-agent-orchestrator-transforming-developer-cli-tools-into-a-multi-agent-powerhouse/) — MEDIUM confidence (official blog, October 2025)
- [awslabs/cli-agent-orchestrator GitHub](https://github.com/awslabs/cli-agent-orchestrator) — MEDIUM confidence (repo not directly fetchable in this session; details from web search summaries)
- [workmux official docs](https://workmux.raine.dev/) — MEDIUM confidence (official docs, December 2025)
- [raine/workmux GitHub](https://github.com/raine/workmux) — MEDIUM confidence
- [Dicklesworthstone/ntm GitHub](https://github.com/Dicklesworthstone/ntm) — LOW confidence (web search summary only)
- [Agentmaxxing — Vibe Coding App](https://vibecoding.app/blog/agentmaxxing) — LOW confidence (community article, early 2026)
- [Google Developers Blog — Multi-agent patterns in ADK](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) — MEDIUM confidence (official Google source)
- [Multi-Agent System Failure Taxonomy — arxiv 2503.13657](https://arxiv.org/pdf/2503.13657) — HIGH confidence (peer-reviewed, March 2025)
- [Galileo — Multi-Agent Coordination Strategies](https://galileo.ai/blog/multi-agent-coordination-strategies) — LOW confidence (vendor blog)
- [OWASP LLM Top 10 2025](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — HIGH confidence (official OWASP standard)
- [builder.io — Improve AI output with AGENTS.md](https://www.builder.io/blog/agents-md) — MEDIUM confidence (practitioner article)

---

*Feature research for: AI CLI orchestration wrapper (portable multi-agent developer environment)*
*Researched: 2026-03-24*
