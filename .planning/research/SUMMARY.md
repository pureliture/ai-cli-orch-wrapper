# Project Research Summary

**Project:** AI CLI Orchestration Wrapper
**Domain:** TypeScript/Node.js CLI tool — portable multi-agent developer environment (tmux + CAO + workmux)
**Researched:** 2026-03-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project is a developer-facing CLI wrapper that turns a fresh machine into a reproducible multi-agent AI development environment with one command. Experts build this class of tool as a thin orchestration layer over existing binaries — never reimplementing what those binaries already do. The correct pattern is to treat `tmux`, `cao`, and `workmux` as stable external processes controlled via `execa`, not as libraries to be wrapped or replaced. The wrapper's job is: bootstrap the environment, download and lockfile agent profiles, and wire CLI tools into named workflow roles — nothing more.

The recommended approach is a layered CLI architecture with strict component separation: a setup layer (idempotent env bootstrap), a profile layer (URL-driven lockfile downloads), a tmux session manager (pane lifecycle only), and a workflow engine (role mapping and handoff routing). Each layer must be built and validated independently before the next layer depends on it. The build order is determined by dependency: profile download requires only Node.js builtins; setup depends on profile download; tmux management is isolated; workflows depend on both tmux and cao integration. This order also maps cleanly to the feature priority tiers identified in research.

The dominant risks are all operational, not algorithmic. The three highest-impact pitfalls — tmux `send-keys` race conditions, pane target ambiguity, and silent prerequisites failures on fresh machines — have been reproduced in production systems (including Claude Code's own team-agents feature). Every one of them can be prevented with defensive coding patterns established in Phase 1: pane ID capture at creation time, preflight checks before any side effects, and readiness polling instead of `sleep`. Registry coupling (hardcoded URLs sneaking in as "sensible defaults") is the other systemic risk and must be treated as an architectural constraint from day one, not a cleanup task.

---

## Key Findings

### Recommended Stack

The full stack is already substantially chosen by the existing project. The key additions are `commander` with `@commander-js/extra-typings` for typed subcommand parsing, `execa` v9 for all process execution (tmux CLI, cao CLI, workmux CLI), `conf` v15 for user-level config persistence, and `@clack/prompts` for interactive setup UX. All packages are pure-ESM, matching the project's existing `"type": "module"`. The Node.js floor should be raised from `>=18` to `>=20 LTS` to support `execa` v9 and current ESM patterns cleanly.

No npm library exists for tmux control — all candidates (`node-tmux`, `tmuxn`) are abandoned. `execa` wrapping the tmux CLI is the only viable and correct approach. If registry manifest validation becomes complex, `zod` is the recommended addition, but it is not needed for v1.

**Core technologies:**
- TypeScript ^5.4: primary language — project already uses TS5; `@commander-js/extra-typings` requires TS 5.0+
- Node.js >=20 LTS: runtime floor — required for `execa` v9 and pure-ESM packages
- `commander` ^13.1 + `@commander-js/extra-typings` ^13.1: CLI parsing — 500M weekly downloads, zero runtime deps, 18ms startup, strongly typed
- `execa` ^9.6: all process execution — pure-ESM, promise-based, automatic zombie cleanup, correct tool for calling known binaries
- `conf` ^15.1: user config persistence — XDG-compliant, JSON Schema validation, modern successor to `configstore`
- `@clack/prompts` ^0.9: interactive UX — replaces inquirer + ora + chalk in one package
- `chalk` ^5.4: non-interactive terminal color — pure-ESM (v5+) required for `"type": "module"` projects

### Expected Features

Research identifies a clean three-tier feature model. The v1 MVP is entirely P1 — six features that together deliver the core value proposition. P2 adds polish and power-user capabilities. P3 defers the most complex inter-CLI orchestration until simpler workflows validate the foundation.

**Must have (table stakes — v1 MVP):**
- Single-command setup (`wrapper setup`) — core value prop: any machine, one command, same env
- Non-invasive tmux conf management — write only to `~/.config/tmux/ai-cli.conf`, never `~/.tmux.conf` directly
- cao profile download + lockfile — URL-driven profile fetch with SHA-256 verification and `wrapper.lock` tracking
- Declarative workflow role mapping — config maps CLI names to roles (orchestrator, reviewer, executor)
- tmux session launch per workflow — `wrapper start <workflow>` opens correctly-named panes with correct CLIs
- Idempotent setup — re-running `wrapper setup` is safe on an already-configured machine

**Should have (competitive differentiators — v1.x):**
- worktree-based task isolation via workmux — parallel agents on separate git worktrees, no merge conflicts
- worktree cleanup command — prevents orphaned directories from accumulating
- tmux window status titles reflecting agent state — strong DX improvement, low implementation cost
- Workflow extensibility via YAML files — user-defined role topologies without source changes

**Defer (v2+):**
- Plan→review inter-CLI loop with structured handoff — highest complexity, requires robust message passing and exit condition logic
- Cross-provider heterogeneous orchestration hardening — per-provider auth adapters; build one well before generalizing
- Profile registry search — blocked on registry-hub API stabilization

### Architecture Approach

The recommended architecture is a layered CLI wrapper with seven discrete components, each with a single clear responsibility and explicit "does NOT" boundary. The wrapper CLI entry point routes commands without knowing about tmux or cao internals. The setup layer handles idempotent bootstrap only. The profile layer handles download and lockfile management only — it has no knowledge of tmux or workflows. The tmux session manager handles pane lifecycle and send-keys only — it has no knowledge of workflow logic. The workflow engine orchestrates role mapping and handoff routing, delegating all execution to the adapters below it.

**Major components:**
1. wrapper CLI (entry point) — argument parsing, command routing, error handling; no direct tmux or cao knowledge
2. Setup Layer — idempotent env bootstrap; writes `ai-cli.conf`, injects one source line, delegates to Profile Layer
3. Profile Layer — URL-driven download, SHA-256 verification, atomic lockfile write; no tmux or workflow knowledge
4. Workflow Engine — role→CLI mapping from YAML, session launch coordination, inter-CLI handoff routing
5. cao Adapter — constructs cao invocations, maps wrapper workflow concepts to cao handoff/assign patterns
6. tmux Session Manager — session/window/pane creation via `execa('tmux', [...])`, window title updates
7. workmux Bridge — worktree lifecycle management on demand; sets up environment only, no direct AI CLI interaction

Inter-CLI communication must be file-based (write to `.wrapper/inbox/<agent-id>.json`, poll for it), not `send-keys`-based. `send-keys` is acceptable only for initial session bootstrapping.

### Critical Pitfalls

Research surfaced 10 pitfalls. The five most impactful with cross-cutting consequences:

1. **tmux send-keys race condition (shell not ready)** — use `split-window "command"` to pass commands as pane init process, or poll `#{pane_current_command}` for readiness. Never use `sleep`. This is a confirmed production issue in Claude Code team-agents (GitHub #23513).

2. **tmux pane target ambiguity (wrong pane receives keys)** — always capture pane ID at creation time with `#{pane_id}` and use that stable ID for all subsequent targeting. Never use bare session name or numeric index. Never use spaces in session names.

3. **Bootstrap fails silently on fresh machines** — run a preflight check for `tmux`, `cao`, and `workmux` on `$PATH` before any config files are written. Fail fast with a named error and install link. Never write partial state.

4. **Registry coupling via "sensible default" URLs** — the wrapper ships with no default registry URL. The user must configure it explicitly. No registry URL strings appear in source code. Treat registry URL like an API key.

5. **Hardcoded absolute paths in config and scripts** — use `os.homedir()` and `path.join()` in TypeScript; use `$HOME` and `$XDG_CONFIG_HOME` in shell. Never hardcode `/Users/username/`. Verify on a machine with a different username before any milestone is closed.

---

## Implications for Roadmap

Based on research, dependencies determine phase order. Each phase must fully validate before the next phase builds on it. Five phases are sufficient.

### Phase 1: Foundation (CLI skeleton + config + profile download)

**Rationale:** Profile download has zero external dependencies — it requires only Node.js builtins (`fs/promises`, `crypto`, `fetch`). This is where the lockfile contract, registry decoupling, and atomic write patterns must be established before anything else touches them. Getting this wrong poisons every subsequent phase.

**Delivers:** Working `wrapper profile install <url>` command, `wrapper.lock` tracking with SHA-256 pinning, user config system (`~/.config/ai-cli/config.json`), preflight prerequisite checks, CLI skeleton with version and help

**Addresses features:** cao profile download + lockfile, non-hardcoded registry URL (anti-feature prevention)

**Avoids pitfalls:** Registry coupling (Pitfall 9), hardcoded absolute paths (Pitfall 8), non-atomic lockfile write (Technical Debt), silent prerequisites missing (Pitfall 6 — preflight logic established here even though full setup is Phase 2)

**Research flag:** Standard patterns — well-documented Node.js patterns, skip research-phase

---

### Phase 2: Environment Setup (idempotent bootstrap)

**Rationale:** Depends on the Profile Layer from Phase 1. This delivers the "single command" core value proposition and validates the portability claim. Must be tested on a fresh machine — this is the phase that breaks most often in comparable tools.

**Delivers:** `wrapper setup` command, idempotent `~/.config/tmux/ai-cli.conf` write, single `source-file` line injection into `~/.tmux.conf` (guarded), end-to-end "clone repo + one command = configured machine" flow

**Addresses features:** Single-command setup, non-invasive tmux conf management, idempotent setup

**Avoids pitfalls:** tmux conf keybinding conflicts (Pitfall 3 — `unbind -T prefix -aq` before redefining), bootstrap prerequisites missing (Pitfall 6), hardcoded absolute paths (Pitfall 8)

**Research flag:** Standard patterns — tmux `source-file` injection is well-documented; skip research-phase

---

### Phase 3: tmux Session Manager

**Rationale:** The Workflow Engine depends entirely on this component, so it must be built and validated in isolation before workflow logic is layered on top. This is the most complex subsystem — pane ID capture, readiness polling, and correct target syntax must all be locked in here. Errors discovered after the Workflow Engine is wired are significantly harder to debug.

**Delivers:** `wrapper start <workflow>` skeleton that creates named tmux sessions and panes, captures pane IDs at creation time, polls for shell readiness before sending keys, updates window titles

**Addresses features:** tmux session management, tmux window status titles (partial)

**Avoids pitfalls:** send-keys race condition (Pitfall 1 — readiness polling required), pane target ambiguity (Pitfall 2 — pane ID capture required), tmux conf conflicts (Pitfall 3 — already addressed in Phase 2)

**Research flag:** Needs research-phase — tmux scripting correctness depends on specific shell environments (zsh + oh-my-zsh edge cases) and the readiness polling implementation. Validate patterns before wiring workflows on top.

---

### Phase 4: cao Integration and Basic Workflows

**Rationale:** Depends on tmux Session Manager (Phase 3) and Profile Layer (Phase 1). This is where the first end-to-end workflow runs: `wrapper start <workflow-name>` resolves role→CLI mapping from a YAML definition, launches tmux panes, and configures cao with the correct profile. Delivers the first version of the product that a user can actually run.

**Delivers:** Workflow YAML format definition, role→CLI mapping, `wrapper start <workflow>` end-to-end, cao profile written to correct `agent_store/` path, cao adapter that constructs correct invocations, at least one working built-in workflow (e.g., `single-agent`)

**Addresses features:** Declarative workflow role mapping, tmux session launch per workflow

**Avoids pitfalls:** cao profile written to wrong path (Pitfall 4 — verify `agent_store/` path from cao's own config), cao TOML float mismatch (Pitfall 10 — `tool_timeout_sec = 600.0`), multi-agent send-keys message delivery (Pitfall 7 — use file-based handoff, not send-keys for agent comms)

**Research flag:** Needs research-phase — cao's `agent_store` path resolution and invocation API are documented but nuanced; TOML config schema needs verification before writing config generation code.

---

### Phase 5: Advanced Workflows (worktree isolation + inter-CLI loops)

**Rationale:** Highest complexity, builds on the entire stable foundation. Plan→review loops require working message passing; worktree isolation requires a working session manager. These are v1.x and v2+ features — they must not block the v1 launch but are planned here so the architecture accommodates them.

**Delivers:** workmux Bridge (`wrapper worktree start/stop/cleanup`), file-based inter-CLI message queue, plan→review loop with exit conditions and iteration limits, workflow extensibility via user-defined YAML files

**Addresses features:** worktree-based isolation via workmux, worktree cleanup, plan→review loop (v2+), workflow extensibility (v1.x)

**Avoids pitfalls:** Orphaned worktrees (Pitfall 5 — `git worktree remove` + `prune` in finally block, never `rm -rf`), multi-agent message fragility (Pitfall 7 — file-based queue, not send-keys), real-time streaming bus (anti-feature from FEATURES.md)

**Research flag:** Needs research-phase — inter-CLI message passing patterns and loop termination signals are not fully documented; workmux lifecycle API needs verification for the Bridge design.

---

### Phase Ordering Rationale

- Profile download before setup: setup triggers profile download; lockfile correctness must be proven before it is used in the critical-path bootstrap flow
- tmux manager before workflow engine: a wrong pane ID in the session manager is a silent bug that corrupts every workflow built on top; isolation forces the bug to surface early
- cao integration after tmux: cao processes run inside tmux panes; you cannot validate cao placement without a working session scaffold
- Advanced workflows last: inter-CLI loops are the highest-complexity feature and the most likely to change design; build on a stable foundation to avoid rework

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (tmux Session Manager):** Shell readiness polling behavior varies significantly with zsh plugins; need verified patterns for polling `#{pane_current_command}` correctly across shell configurations
- **Phase 4 (cao Integration):** cao `agent_store` path resolution, TOML config schema, and invocation API need direct verification — the AWS blog describes intent; the GitHub repo provides implementation details that must be confirmed
- **Phase 5 (Advanced Workflows):** Inter-CLI message passing and workmux Bridge lifecycle API are not fully documented in available sources; workmux official docs are the primary reference

Phases with well-established patterns (skip research-phase):
- **Phase 1 (Foundation):** Node.js `fs/promises`, `crypto`, `fetch`, and atomic file writes are all standard, well-documented patterns
- **Phase 2 (Environment Setup):** tmux `source-file` injection and XDG config path conventions are stable and well-documented

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core choices (commander, execa, conf, chalk) verified against official sources and download stats. tmux control via execa is the only viable pattern — npm alternatives are confirmed abandoned. ESM compatibility of full stack verified. |
| Features | MEDIUM-HIGH | Table stakes and differentiators well-supported across multiple sources. CAO feature set from AWS official blog (October 2025). Inter-CLI loop patterns from peer-reviewed multi-agent failure taxonomy (arxiv 2503.13657). CAO GitHub not directly fetched — some details from web search summaries. |
| Architecture | HIGH | Layered component model consistent across CAO docs, workmux docs, and tmux scripting best practices. Component boundaries are internally consistent with zero circular dependencies. Build order validated against feature dependency graph. |
| Pitfalls | HIGH (tmux/worktree), MEDIUM (cao-specific) | tmux race condition verified against Claude Code GitHub issue #23513 and tmux/tmux#3360. Worktree orphaning verified against anomalyco/opencode#14648. CAO agent_store path and TOML float pitfalls from AWS blog + integration doc — not independently verified against running cao. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **cao `agent_store` exact path:** Research identifies `~/.aws/cli-agent-orchestrator/agent_store/` as the default, but the wrapper must read this from cao's own config at runtime rather than assume the default. Verify cao's config discovery mechanism during Phase 4 planning.
- **workmux Bridge API:** workmux documentation covers single-project `.workmux.yaml` setup. Programmatic invocation from a parent wrapper needs verification — whether `workmux start <task>` is the correct CLI interface or whether the YAML must be written dynamically. Validate during Phase 5 planning.
- **CAO handoff/assign signal format:** The AWS blog describes handoff and assign as orchestration patterns, but the exact message format and completion signal syntax for the plan→review loop are not documented in available sources. This is a known gap — design should remain flexible until Phase 5 planning.
- **Registry-hub API shape:** Registry-hub is under parallel development. Phase 3 (registry search, deferred to P3) cannot be designed until that API stabilizes. The lockfile format should be designed to accommodate additional registry metadata without breaking changes.

---

## Sources

### Primary (HIGH confidence)
- [execa GitHub — sindresorhus/execa](https://github.com/sindresorhus/execa) — process execution API, v9 ESM requirements
- [commander v13 changelog](https://github.com/tj/commander.js/blob/master/CHANGELOG.md) — CLI parsing, startup benchmarks
- [@commander-js/extra-typings](https://github.com/commander-js/extra-typings) — TypeScript inference requirements
- [conf npm page](https://www.npmjs.com/package/conf) — v15.1.0, XDG paths, JSON Schema validation
- [tmux scripting patterns — tao-of-tmux](https://tao-of-tmux.readthedocs.io/en/latest/manuscript/10-scripting.html) — pane ID capture, wait-for channels
- [tmux Getting Started Wiki](https://github.com/tmux/tmux/wiki/Getting-Started) — target hierarchy, session naming rules
- [Claude Code team agents tmux race condition — GitHub Issue #23513](https://github.com/anthropics/claude-code/issues/23513) — send-keys shell readiness
- [tmux send-keys race condition — GitHub Issue #3360](https://github.com/tmux/tmux/issues/3360) — confirmed race condition
- [Git worktree official documentation](https://git-scm.com/docs/git-worktree) — worktree lifecycle, prune behavior
- [Worktree bootstrap failures — GitHub Issue #14648](https://github.com/anomalyco/opencode/issues/14648) — orphaned directory pattern
- [Multi-Agent System Failure Taxonomy — arxiv 2503.13657](https://arxiv.org/pdf/2503.13657) — peer-reviewed, error amplification patterns
- [OWASP LLM Top 10 2025](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — security posture for AI profile downloads

### Secondary (MEDIUM confidence)
- [AWS Open Source Blog — Introducing CLI Agent Orchestrator](https://aws.amazon.com/blogs/opensource/introducing-cli-agent-orchestrator-transforming-developer-cli-tools-into-a-multi-agent-powerhouse/) — CAO feature set, agent store path, handoff/assign patterns
- [CAO Codex CLI integration doc — awslabs/cli-agent-orchestrator](https://github.com/awslabs/cli-agent-orchestrator/blob/main/docs/codex-cli.md) — TOML float gotcha, MCP config schema
- [workmux official docs](https://workmux.raine.dev/) — worktree lifecycle, .workmux.yaml format
- [node-tmux Snyk advisor](https://snyk.io/advisor/npm-package/node-tmux) — maintenance status verified (abandoned)
- [tmux ArchWiki](https://wiki.archlinux.org/title/Tmux) — source-file additive behavior, keybinding conflicts
- [chalk ESM requirements](https://www.npmjs.com/package/chalk) — v5 pure-ESM requirement
- [Google Developers Blog — Multi-agent patterns in ADK](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) — orchestration pattern validation
- [builder.io — AGENTS.md format](https://www.builder.io/blog/agents-md) — profile format conventions

### Tertiary (LOW confidence)
- [Agentmaxxing — Vibe Coding App](https://vibecoding.app/blog/agentmaxxing) — worktree isolation as 2025–2026 pattern, needs validation
- [Dicklesworthstone/ntm GitHub](https://github.com/Dicklesworthstone/ntm) — competitor feature comparison, web search summary only
- [Galileo — Multi-Agent Coordination Strategies](https://galileo.ai/blog/multi-agent-coordination-strategies) — vendor blog, directionally useful

---

*Research completed: 2026-03-24*
*Ready for roadmap: yes*
