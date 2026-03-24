# Pitfalls Research

**Domain:** AI CLI orchestration wrapper — tmux, cao, worktree, multi-agent, portability
**Researched:** 2026-03-24
**Confidence:** HIGH (tmux/worktree pitfalls verified against official issues and docs), MEDIUM (cao-specific verified against AWS open source blog and GitHub), MEDIUM (multi-agent IPC patterns from multiple 2025 sources)

---

## Critical Pitfalls

### Pitfall 1: tmux send-keys fires before shell is ready (race condition)

**What goes wrong:**
`tmux new-window` or `tmux split-window` creates a pane, then `send-keys` is called immediately after. On zsh with plugins (oh-my-zsh, powerlevel10k, etc.), the shell initialization takes several hundred milliseconds. The keystrokes land before the prompt is ready and are either silently lost or displayed as literal text without execution. The pane looks active but the command never ran.

This is a confirmed, tracked issue in the Claude Code project (GitHub issue #23513): team agents fail to start because `send-keys` sends before zsh finishes loading `.zshrc`.

**Why it happens:**
Developers assume `new-window` returns after the shell is interactive. It returns after the pane is created, not after the shell process is ready to accept input. On bash with a minimal profile the gap is tiny; on zsh with a full plugin stack it can be 500ms–2s.

**How to avoid:**
- Prefer `tmux new-window "command"` or `tmux split-window "command"` to pass the command as the pane's initial process rather than sending it as keys. This bypasses the race entirely.
- If `send-keys` is required (e.g., interactive CLI like `claude`), poll for shell readiness: check `tmux display-message -p '#{pane_current_command}'` until it is `zsh`/`bash` (not `tmux`), then send keys.
- Never use a fixed `sleep` as the synchronization mechanism — it creates a different race on slow machines and wastes time on fast ones.

**Warning signs:**
- Pane shows the command text in the prompt but no output follows
- Works on developer's machine (minimal zsh), breaks on another machine (full oh-my-zsh)
- Works when run manually step-by-step, fails when run from a script

**Phase to address:** Orchestration wiring phase (any phase that creates tmux panes and sends AI CLI commands into them)

---

### Pitfall 2: tmux target ambiguity sends keystrokes to the wrong pane

**What goes wrong:**
`tmux send-keys -t session_name` without a window and pane index sends to the session's currently active pane — whichever pane the user last touched. When a workflow spawns multiple AI CLI panes (orchestrator, reviewer, planner), a user navigating panes between script steps causes subsequent `send-keys` calls to land in the wrong pane, corrupting the wrong agent's context silently.

**Why it happens:**
tmux resolves ambiguous targets to the active pane by default. Scripts that worked when tested alone (single session, single window) break when multiple windows or panes exist. Session names with spaces also cause shell-quoting failures in target strings.

**How to avoid:**
- Always use the full target syntax: `tmux send-keys -t "session:window.pane"` — never omit the pane index.
- Prefer stable pane IDs (`%1`, `%2`) over index-based addressing: capture with `tmux display-message -p '#{pane_id}'` at pane-creation time and store for reuse.
- Never use spaces in session names. Use `ai-cli-orch` not `ai cli orch`.
- After creating each pane, store its pane ID in a local variable or state file immediately.

**Warning signs:**
- Commands appear in the wrong terminal pane
- Script works in a fresh tmux server, breaks when user has existing panes open
- Errors from `cao` or `claude` about unexpected input

**Phase to address:** tmux session scaffolding phase (early — before any multi-pane workflows are wired)

---

### Pitfall 3: tmux conf source order causes keybinding conflicts and stale bindings

**What goes wrong:**
The project writes `~/.config/tmux/ai-cli.conf` and adds a `source-file` line to the base tmux config. tmux's config loading is additive, not resetting. If the base config (from `ghostty-tmux-wrapping`) also defines the same keybindings, the last `source-file` wins. More subtly, reloading the config mid-session does not remove bindings set in a previous load — stale bindings from an earlier version persist until the tmux server is restarted.

**Why it happens:**
Developers expect `source-file` to work like a clean import. It doesn't — it is line-by-line evaluation appended to existing state. This is confirmed tmux behavior, not a bug.

**How to avoid:**
- Open `ai-cli.conf` with `unbind -T prefix -aq` to clear the prefix key table before redefining any bindings. Only do this if the file owns those bindings exclusively.
- Better: use unique key prefixes for all ai-cli-orch bindings that are unlikely to conflict with the base config. Coordinate with `ghostty-tmux-wrapping` on reserved key namespaces.
- Document the source order: base tmux.conf first, then ai-cli.conf. This is the agreed contract — do not reverse it.
- After changes to `ai-cli.conf`, instruct users to run `tmux source-file ~/.config/tmux/ai-cli.conf` AND warn that a full server restart may be needed for UI-level changes.

**Warning signs:**
- Keybinding does something different from what the config says
- Config changes appear to have no effect after reload
- `tmux list-keys` shows duplicate bindings for the same key

**Phase to address:** Setup/bootstrap phase (the phase that writes and installs `ai-cli.conf`)

---

### Pitfall 4: cao profile treated as a tight dependency rather than a URL-fetched artifact

**What goes wrong:**
If the wrapper hard-codes cao agent profile paths, registry URLs, or profile filenames, it breaks the moment the external registry moves a file, renames a profile, or changes its directory structure. The registry-hub is an independent parallel project — any version skew between wrapper expectations and registry reality causes silent failures where cao loads stale or missing profiles.

A specific cao gotcha: the `~/.aws/cli-agent-orchestrator/agent_store/` directory is the custom agent store path. If the wrapper writes profiles to a different location without configuring `agent_store` in cao's config, cao silently ignores the downloaded profiles and uses its built-in defaults.

**Why it happens:**
During development, profile paths are hardcoded for convenience. Registry URLs are known at time of writing so they get embedded. This coupling turns what should be a configuration concern into a code concern.

**How to avoid:**
- All registry URLs must live in a config file (e.g., `config.json` or a user-editable `.wrapper/config.toml`), never hardcoded in source.
- The wrapper's job is: receive URL → download → write to `agent_store/` path → update lockfile. The URL itself is always external configuration.
- When writing profiles, always write to the path cao uses as its agent store. Verify this path from cao's own config rather than assuming a default.
- The lockfile must record `registryType`, `contentUrl`, and `channel` per item — not just `localPath` and `downloadedAt` — so that updates can be driven by re-fetching the same canonical URL.

**Warning signs:**
- cao uses built-in profiles instead of the downloaded ones
- Profile changes in the registry require a code change in the wrapper
- Wrapper breaks after registry reorganizes its URL structure

**Phase to address:** Registry download / cao profile management phase

---

### Pitfall 5: Worktree lifecycle not cleaned up, leaving orphaned directories

**What goes wrong:**
When workmux creates a worktree for an isolated task and the task completes (or fails mid-way), the worktree directory and its git metadata are left behind. git continues to track the stale entry. Subsequent `git worktree add` calls for the same path or branch fail with "already exists" or "already checked out" errors. On machines used over weeks, orphaned worktrees accumulate and cause branch checkout conflicts across all worktrees.

A real-world tracked issue (GitHub: anomalyco/opencode #14648): bootstrap failures during worktree creation leave behind orphaned directories because the cleanup code only runs on success paths.

**Why it happens:**
Worktree creation is multi-step: `mkdir`, `git worktree add`, `git branch`, optional dependency install. If step 3 fails, step 1 and 2 have already committed side effects. Without error-path cleanup, the partial state persists.

**How to avoid:**
- Wrap worktree creation in a try/catch/finally pattern: always run `git worktree remove --force <path>` and `git worktree prune` in the finally block.
- Never use `rm -rf` to remove a worktree — it orphans the git metadata without cleaning it from `.git/worktrees/`.
- After completing a workflow that used a worktree, the cleanup step must run even if the workflow errored. Treat cleanup as mandatory, not optional.
- Expose a `wrapper worktree cleanup` command that runs `git worktree list`, identifies prunable entries, and removes them. Run this during bootstrap to clear state from crashed sessions.
- On bootstrap of a fresh machine: run `git worktree prune` early in the setup sequence before any new worktrees are created.

**Warning signs:**
- `git worktree list` shows entries pointing to non-existent directories
- `git worktree add` fails with "path is already registered"
- `git branch` shows branches that appear to be in use but their worktree directory is gone

**Phase to address:** Worktree / workmux integration phase, and also the bootstrap/setup phase

---

### Pitfall 6: Bootstrap fails silently on a fresh machine due to missing prerequisites

**What goes wrong:**
The wrapper assumes cao, tmux, and workmux are already installed and accessible on `$PATH`. On a fresh machine, if any of these are missing, the bootstrap script either throws a cryptic error (`command not found: tmux`) or, worse, partially succeeds — writing config files for tools that aren't installed yet, leaving the machine in a mixed state that requires manual cleanup before retrying.

**Why it happens:**
Developer tools are typically built and tested on the developer's own machine where all prerequisites are installed. The "single command restore" promise is only validated in an environment that's already set up. The first truly fresh machine exposes all the assumptions.

**How to avoid:**
- Start every bootstrap script with a preflight check: verify `tmux`, `cao`, and `workmux` are on `$PATH` and exit immediately with a clear message if any are missing. Name the missing tool and link to its install page.
- Make the preflight check idempotent and fast — it must be safe to re-run on a machine that's halfway set up.
- Never write any config files until all prerequisite checks pass. Fail-fast before any side effects.
- Test the bootstrap script on a fresh machine (or Docker container) before tagging any milestone as complete.

**Warning signs:**
- Bootstrap succeeds but `tmux` sessions don't appear
- `wrapper` binary is installed but `cao` commands fail
- Re-running bootstrap produces different errors each time (state from partial first run)

**Phase to address:** Setup/bootstrap phase (must be the first phase to address this, as all other phases depend on it)

---

### Pitfall 7: Multi-agent message passing through tmux is fragile and unobservable

**What goes wrong:**
Using `tmux send-keys` to deliver messages from one AI CLI pane to another (orchestrator → reviewer → executor) couples the communication layer to tmux's process model. If a receiving agent is still processing (BUSY), the sent keys land in the middle of its current input. There is no delivery confirmation, no retry, and no queue. Silent delivery failures look identical to successful delivery from the sender's perspective.

CAO itself solves this with an inbox/watchdog pattern (MCP server with a database queue, idle detection via log-file monitoring), but replicating this on top of raw `send-keys` without that infrastructure leads to unreliable workflows.

**Why it happens:**
`send-keys` is the obvious primitive for pane-to-pane communication. It is easy to get working in a demo where timing is controlled. It silently falls apart when agents have variable processing times.

**How to avoid:**
- Do not use `send-keys` for agent-to-agent message passing. Use a file-based message queue (e.g., write to `.wrapper/inbox/<agent-id>.json`, let the receiving agent poll or watch for it) or leverage cao's built-in MCP `send_message` mechanism.
- If raw `send-keys` is used for initial session bootstrapping only (not for ongoing communication), that is acceptable but must be clearly scoped.
- Any workflow that requires an agent to "wait for" another agent must use a polling-with-timeout pattern, not a fixed sleep.

**Warning signs:**
- Agent responses appear interleaved or out of order
- Messages are dropped when agents are slow to respond
- Workflow "works" in controlled testing but fails randomly in real use

**Phase to address:** Multi-agent communication / workflow wiring phase

---

### Pitfall 8: Hardcoded absolute paths in config files break on new machines

**What goes wrong:**
Config files committed to the repo contain absolute paths (`/Users/username/.config/tmux/`, `/home/dev/projects/`). When the repo is cloned on a new machine with a different username or home directory layout, the wrapper either fails with "no such file or directory" or silently uses wrong paths that happen to exist.

The codebase analysis already flagged this for the TypeScript layer (download directory hardcoded as `.wrapper/downloads`, lock file hardcoded as `wrapper.lock`). The same risk extends to shell scripts and tmux config that reference absolute paths.

**Why it happens:**
Absolute paths work perfectly on the developer's machine. The portability assumption is never tested until the second machine.

**How to avoid:**
- Use `$HOME` or `~` for all user-relative paths in shell scripts and tmux configs. Never hardcode `/Users/username/`.
- Use `$XDG_CONFIG_HOME` (defaulting to `~/.config`) for config file locations.
- In TypeScript, use `os.homedir()` and `path.join()` — never string concatenation with a literal home path.
- The wrapper's own install location must be resolved dynamically (e.g., via `dirname $(realpath "$0")` in shell), not assumed to be at a fixed path.
- Run the full bootstrap on a machine with a different username before any milestone is declared done.

**Warning signs:**
- Works for the original developer, fails for anyone else
- `tmux source-file` reports "no such file" on a new machine
- cao profile paths contain the original developer's username

**Phase to address:** Setup/bootstrap phase (prevent before any config files are written)

---

### Pitfall 9: Registry coupling sneaks in through assumed default URLs

**What goes wrong:**
Even when the registry URL is not hardcoded in source code, it ends up hardcoded in documentation, default config values, or "if no config found, use this URL" fallback logic. Any one of these creates a coupling between the wrapper and the registry-hub, violating the explicit constraint that the wrapper must treat the registry as a pure URL-configured dependency.

If the registry-hub reorganizes its URL structure (e.g., moves from GitHub to another host, or restructures its JSON-LD catalog paths), the wrapper breaks wherever a URL is assumed rather than configured.

**Why it happens:**
The "sensible default" pattern is a standard DX improvement. But for an external project under independent development, any default is an undeclared dependency.

**How to avoid:**
- The wrapper ships with no default registry URL. The user must configure it explicitly.
- If a default is truly necessary for DX, it must live in a clearly labeled section of the user-editable config file (not in source code), and the README must state that the URL is user-controlled.
- Never read a registry URL from an environment variable that has a hardcoded default in source.
- Treat the registry URL the same way you would treat an API key — it is external configuration, not internal state.

**Warning signs:**
- Source code contains `https://raw.githubusercontent.com/skillinterop/` strings
- `config.json` in the repo contains registry URLs (instead of leaving them blank for user to fill)
- Tests mock a specific registry URL rather than a configurable one

**Phase to address:** Registry download phase (establish the contract before writing any fetch code)

---

### Pitfall 10: cao TOML float type mismatch silently reverts timeout to 60 seconds

**What goes wrong:**
When configuring cao's MCP server settings (e.g., `tool_timeout_sec`), the value must be a TOML float (`600.0`), not a TOML integer (`600`). If an integer is written, cao silently falls back to the 60-second default. Long-running AI CLI operations (code generation, multi-step reviews) then time out without a useful error, appearing as if the MCP server disconnected.

**Why it happens:**
TOML has distinct integer and float types. Code generation that writes config files programmatically often writes `600` (integer) when the schema expects `600.0` (float). The failure is silent.

**How to avoid:**
- When generating TOML config for cao, always write timeout values as floats: `tool_timeout_sec = 600.0`.
- Add a config validation step after writing cao's config: read it back and assert that `tool_timeout_sec` is a TOML float type.
- In any config templates committed to the repo, use the float form with a comment explaining why.

**Warning signs:**
- MCP server operations time out after exactly 60 seconds
- Changing `tool_timeout_sec` in the config has no effect
- cao logs show timeout as "60s" regardless of config value

**Phase to address:** cao integration phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `sleep 1` between tmux operations | Simple synchronization, works most of the time | Breaks on slow machines; wastes time on fast ones; masks real race condition | Never — use readiness polling instead |
| Hardcoding registry URL in source | Easier to bootstrap | Breaks on any registry restructure; violates decoupling constraint | Never for this project |
| Using pane index instead of pane ID for tmux targeting | Shorter code | Breaks when user navigates panes; wrong pane receives keys | Never in automated scripts |
| `rm -rf` to clean worktrees | Faster than `git worktree remove` | Orphans git metadata; causes "already registered" failures | Never — always use `git worktree remove` |
| Writing lockfile with `writeFileSync` directly | Simple one-liner | Non-atomic write; corruption on process interrupt | Never for lockfile operations — use write-then-rename |
| Silent fallback to empty lockfile on parse error | Doesn't crash | Silently destroys all tracked state | Never — always warn or abort |
| Absolute path in tmux config | Works on current machine | Fails on any machine with different username or layout | Never in committed config files |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| cao agent store | Writing profiles to arbitrary path and expecting cao to find them | Write profiles to `~/.aws/cli-agent-orchestrator/agent_store/` or to the path specified in cao's own config; verify the path from cao's config rather than assuming |
| cao MCP config | Writing `tool_timeout_sec = 600` (integer) | Write `tool_timeout_sec = 600.0` (TOML float); validate after writing |
| tmux + zsh | Sending keys immediately after pane creation | Poll `#{pane_current_command}` for readiness, or use `split-window "cmd"` to pass command as pane init process |
| tmux multi-pane | Using session name only as `-t` target | Always use `session:window.pane` or pane ID (`%N`) |
| workmux worktrees | Deleting worktree directory with `rm -rf` | Always `git worktree remove <path>` then `git worktree prune` |
| registry-hub | Fetching from hardcoded URL | Read URL from user config; fail clearly if config is absent |
| ghostty-tmux-wrapping | Writing to `~/.tmux.conf` directly | Write only to `~/.config/tmux/ai-cli.conf`; add one `source-file` line — nothing else |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential registry fetches (hub → N leaves → N content docs) | Slow `wrapper install` even for small installs | Use `Promise.all` with a concurrency limit (`p-limit`) for parallel leaf fetches | At 3+ leaf registries or 10+ profile installs |
| Full lockfile read-modify-write on every operation | Slow for large installs | Acceptable at current scale; plan SQLite migration if items exceed ~200 | At 200+ locked items |
| Fixed `sleep` instead of readiness polling | Slow on fast machines; broken on slow ones | Implement poll-with-timeout from the start | Every time — there is no safe fixed duration |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Fetching arbitrary URL without scheme validation | SSRF-adjacent: `file://` or internal IP exfiltration | Validate scheme is `https:` before any `fetch` call; reject non-HTTPS |
| Writing downloaded content without checksum verification | Compromised upstream or MITM silently writes malicious profile to disk | Store SHA-256 in lockfile at install time; verify on load |
| Non-atomic lockfile write | Process interrupt mid-write corrupts lockfile; silent recovery loses all tracked state | Write to `.wrapper/wrapper.lock.tmp`, then `fs.renameSync` to `wrapper.lock` |
| cao profiles written without source verification | Unverified profiles can override ai agent system prompts | Only accept profiles from configured, trusted registry URLs |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Bootstrap fails with `command not found: cao` mid-script | User has partial state, must manually clean up | Preflight check all dependencies before any side effects; clear message naming the missing tool |
| No feedback during long tmux session setup | User cannot tell if it is working or hung | Print step-by-step progress; show tmux session name when created |
| Lockfile silently reset after parse error | User thinks installs are tracked; they are not | Warn loudly: "wrapper.lock was unreadable, starting fresh — previous installs are not tracked" |
| Registry URL not configured and wrapper silently does nothing | No error, no output, nothing installs | Fail with clear message: "No registry URL configured. Set registry.url in .wrapper/config.toml" |

---

## "Looks Done But Isn't" Checklist

- [ ] **tmux session scaffolding:** Pane creation works in isolation — verify that send-keys still targets correct panes when user navigates between panes during a running workflow
- [ ] **cao profile download:** Profile appears in download directory — verify it is also in cao's `agent_store/` path AND that cao can discover it (`cao list-agents` shows the profile)
- [ ] **Bootstrap single command:** Works on developer's machine — verify on a fresh machine with a different username and zsh plugin set
- [ ] **Lockfile tracking:** `wrapper.lock` is updated — verify it survives a process interrupt mid-write (kill -9 during download) and is not silently zeroed
- [ ] **Worktree cleanup:** Worktrees are removed after task — verify that `git worktree list` shows no prunable entries after workflow completion, including after a workflow that failed mid-execution
- [ ] **Registry decoupling:** Registry URL is in config — verify that no registry URL string appears in source files or committed config with a non-empty default value
- [ ] **tmux conf non-invasive:** Setup adds `source-file` line — verify that `~/.tmux.conf` is not modified beyond the single source line, and that removing the wrapper leaves the base config unmodified

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| tmux send-keys to wrong pane | LOW | Identify correct pane with `tmux list-panes`; manually send correct command; no persistent damage |
| Orphaned worktrees | LOW | Run `git worktree prune`; manually `git worktree remove --force <path>` for remaining entries |
| Corrupt lockfile | MEDIUM | Back up `wrapper.lock`; delete it; re-run `wrapper install` for all needed profiles; lockfile is rebuilt from scratch |
| cao profile not found by cao | LOW | Verify `agent_store` path in cao config; copy profile to correct path; re-run workflow |
| Partial bootstrap on fresh machine | MEDIUM | Run `wrapper cleanup` (if implemented) or manually: remove `~/.config/tmux/ai-cli.conf`; remove the `source-file` line from base tmux config; re-run bootstrap |
| tmux conf keybinding conflicts | MEDIUM | Run `tmux list-keys` to identify conflicts; add `unbind` directives to `ai-cli.conf` before the conflicting binds; reload or restart tmux server |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| send-keys race condition (shell not ready) | Orchestration wiring / tmux session scaffolding | Test: create pane with full zsh config, immediately send-keys — command must execute, not just appear |
| tmux target ambiguity (wrong pane) | tmux session scaffolding | Test: send-keys while user has navigated to a different pane — confirm delivery to correct pane ID |
| tmux conf keybinding conflicts | Setup/bootstrap | Test: reload `ai-cli.conf` multiple times; run `tmux list-keys` — no duplicates |
| cao profile coupling / hardcoded paths | Registry download / cao profile management | Test: change registry URL in config — wrapper fetches from new URL without code changes |
| Worktree lifecycle / orphaned directories | Worktree / workmux integration | Test: kill the workflow mid-execution — `git worktree list` shows no prunable entries after |
| Bootstrap prerequisites missing | Setup/bootstrap | Test: run bootstrap on machine without cao installed — clear error, no partial state |
| Multi-agent send-keys message delivery | Multi-agent workflow wiring | Test: make receiving agent artificially slow — message is still delivered correctly |
| Hardcoded absolute paths | Setup/bootstrap | Test: clone repo as a different OS user — bootstrap succeeds without editing source |
| Registry URL coupling | Registry download phase | Test: grep source for `skillinterop` URL strings — zero matches in non-documentation files |
| cao TOML float mismatch | cao integration | Test: read back written config; assert `tool_timeout_sec` is TOML float; run 5-minute operation and confirm no timeout |

---

## Sources

- [Claude Code team agents tmux race condition — GitHub Issue #23513](https://github.com/anthropics/claude-code/issues/23513)
- [tmux send-keys Ctrl-Z race condition — GitHub Issue #3360](https://github.com/tmux/tmux/issues/3360)
- [Introducing CLI Agent Orchestrator — AWS Open Source Blog](https://aws.amazon.com/blogs/opensource/introducing-cli-agent-orchestrator-transforming-developer-cli-tools-into-a-multi-agent-powerhouse/)
- [CAO Codex CLI integration doc — awslabs/cli-agent-orchestrator](https://github.com/awslabs/cli-agent-orchestrator/blob/main/docs/codex-cli.md)
- [Worktree bootstrap failures leak orphaned directories — GitHub Issue #14648](https://github.com/anomalyco/opencode/issues/14648)
- [Git worktree official documentation](https://git-scm.com/docs/git-worktree)
- [Configuration Drift pitfall — JetBrains Blog](https://blog.jetbrains.com/codecanvas/2025/08/configuration-drift-the-pitfall-of-local-machines/)
- [Why Multi-Agent AI Systems Fail — Galileo](https://galileo.ai/blog/multi-agent-ai-failures-prevention)
- [tmux ArchWiki — modular config, source-file, keybinding conflicts](https://wiki.archlinux.org/title/Tmux)
- [tmux Getting Started Wiki — target hierarchy, session naming](https://github.com/tmux/tmux/wiki/Getting-Started)
- [CLI Agent Orchestrator: When One AI Agent Isn't Enough — DEV Community](https://dev.to/pinishv/cli-agent-orchestrator-when-one-ai-agent-isnt-enough-dc9)
- [Multi-Agent Orchestration Guide 2025 — AI Wiki](https://artificial-intelligence-wiki.com/agentic-ai/agent-architectures-and-components/multi-agent-orchestration/)
- Project codebase analysis: `.planning/codebase/CONCERNS.md`, `ARCHITECTURE.md`, `INTEGRATIONS.md` (2026-03-24)

---

*Pitfalls research for: AI CLI orchestration wrapper (tmux + cao + worktree + multi-agent + portability)*
*Researched: 2026-03-24*
