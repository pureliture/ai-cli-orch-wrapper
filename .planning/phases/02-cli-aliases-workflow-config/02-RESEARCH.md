# Phase 2: CLI Aliases + Workflow Config - Research

**Researched:** 2026-03-24
**Domain:** TypeScript CLI command dispatch, YAML/JSON config parsing, cao CLI integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Config file is `.wrapper.yaml` — project root, committed to repo. Portability-first.
- **D-02:** No global config (`~/.config/...`) — repo contains full environment state.
- **D-03:** Serialization format — YAML (js-yaml dep) vs JSON (zero dep). Delegated to Claude's Discretion (see below).
- **D-04:** `wrapper <alias>` executes `cao launch --provider <provider> --agents <agent>`.
- **D-05:** Extra args after alias are passed through to cao verbatim. e.g. `wrapper claude --session-name my-task` → `cao launch --provider claude_code --agents developer --session-name my-task`.
- **D-06:** Wrapper does NOT manage tmux sessions directly — delegates entirely to cao.
- **D-07:** Phase 2 does NOT modify `~/.config/tmux/ai-cli.conf`. The placeholder comment ("Phase 2 will populate CLI alias bindings here") should be updated to reflect reality.
- **D-08:** `wrapper setup` re-run leaves `ai-cli.conf` untouched if it already exists. tmux key bindings are out of scope.
- **D-09:** `.wrapper.yaml` has two sections: `aliases` (Phase 2) and `roles` (Phase 3).
- **D-10:** Alias entries have two fields: `provider` (cao --provider value) and `agent` (cao --agents value).
- **D-11:** `roles` section is declared in Phase 2 but not consumed until Phase 3.

  Standard schema:
  ```yaml
  aliases:
    claude:
      provider: claude_code
      agent: developer
    gemini:
      provider: gemini_cli
      agent: developer
    codex:
      provider: codex
      agent: developer

  roles:
    orchestrator: claude_code
    reviewer: gemini_cli
  ```

### Claude's Discretion

- **Config serialization format:** YAML (readable, adds js-yaml runtime dep) vs JSON (zero dep, less readable). Strict zero-dep principle → JSON or hand-rolled YAML subset. If js-yaml is acceptable, use YAML.
- Error message format for `wrapper <unknown-alias>` (follow Phase 1 pattern: `console.error` + `process.exit(1)`).
- Dynamic alias routing implementation in `cli.ts` (replace static if/else with alias list loop).
- Behavior when `.wrapper.yaml` is missing — error vs graceful fallback to empty alias list.

### Deferred Ideas (OUT OF SCOPE)

- tmux key bindings (`bind-key C run-shell "wrapper claude"`) — not needed
- workmux-based worktree environment (`wrapper worktree`) — v2 scope (WORK-01)
- Global config (`~/.config/...`) — unnecessary, per-repo is sufficient
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALIAS-01 | User can invoke AI CLIs via short wrapper aliases (e.g., `wrapper claude`, `wrapper gemini`) that map to the appropriate `cao` invocation | cao launch flags confirmed: `--provider`, `--agents` are the correct invocation shape |
| ALIAS-02 | Alias-to-CLI mappings are configurable (not hardcoded in source) so users can add or remap aliases without code changes | Config file parsing pattern identified; dynamic dispatch loop pattern confirmed |
| CONFIG-01 | User can declare role→CLI mappings in a config file (e.g., `orchestrator: claude_code`, `reviewer: gemini_cli`) | `roles` section schema locked in D-09/D-11; parsed but not consumed until Phase 3 |
| CONFIG-02 | Config supports all cao-supported AI CLI providers (claude_code, gemini_cli, codex, copilot_cli, and others cao adds over time) | Provider values are free-form strings passed to `--provider`; no enum needed in wrapper |
| CONFIG-03 | Workflow definitions use cao's native format wherever possible — wrapper does not invent a parallel workflow DSL | `cao flow` manages scheduled flows via its own file format; wrapper's `.wrapper.yaml` only stores provider/agent mappings, not workflow definitions |
</phase_requirements>

---

## Summary

Phase 2 adds two capabilities: (1) short alias commands (`wrapper claude`, `wrapper gemini`, etc.) that dispatch to `cao launch`, and (2) a `.wrapper.yaml` config file that stores those alias mappings and a `roles` section for Phase 3 consumption.

The implementation is entirely within the existing TypeScript CLI layer. No new architectural concepts are introduced — this is a straightforward extension of the Phase 1 command dispatch pattern. The most significant design decision is config format (YAML vs JSON), which directly affects whether a production dependency is added. The recommendation below resolves this in favor of zero dependencies.

The existing `cli.ts` dispatch table uses static `if/else` branching. Phase 2 replaces the unknown-command fallback branch with a config-file lookup: read `.wrapper.yaml` (or `.wrapper.json`), check if the first arg matches an alias key, and if so construct and spawn the `cao launch` command with passthrough args.

**Primary recommendation:** Use JSON format for `.wrapper.json` to maintain zero production dependencies. Name it `.wrapper.json` rather than `.wrapper.yaml` to be honest about the format. JSON is parseable with `JSON.parse(readFileSync(...))` — no new dep required. This is consistent with the existing `wrapper.lock` (JSON) pattern.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` | built-in | Read `.wrapper.json` config file | Already used in Phase 1 (`setup.ts`, `lockfile.ts`) |
| `node:child_process` | built-in | `spawnSync` to invoke `cao launch` | Already used in Phase 1 (`setup.ts` for prereq check) |
| `node:path` | built-in | Resolve config file path relative to cwd | Already used in Phase 1 |
| TypeScript 5.x | ^5.0.0 (devDep) | Source language | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `js-yaml` | 4.1.1 (latest) | Parse YAML config | Only if user preference for `.wrapper.yaml` overrides zero-dep constraint |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON config (`.wrapper.json`) | YAML config (`.wrapper.yaml`) | YAML is more readable but requires `js-yaml` runtime dep (violates zero-dep principle). JSON adds no dep. Recommendation: JSON. |
| `spawnSync` for cao invocation | `execSync` | `spawnSync` avoids shell injection, consistent with Phase 1 prereq check pattern. |
| `spawnSync` for cao invocation | `spawn` (async) | `spawnSync` is simpler and appropriate — wrapper is a thin passthrough, not a long-running daemon. |

**Installation:**
```bash
# No new dependencies required (JSON path)
# If YAML is chosen:
npm install js-yaml
npm install --save-dev @types/js-yaml
```

**Version verification (js-yaml, if chosen):**
```bash
npm view js-yaml version
# Verified: 4.1.1 (2026-03-24)
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── cli.ts               # Extended: alias lookup before unknown-command fallback
├── commands/
│   ├── setup.ts         # Modified: update ai-cli.conf placeholder comment (D-07)
│   └── alias.ts         # New: aliasCommand(name, remainingArgs) handler
├── config/
│   └── wrapper-config.ts  # New: readWrapperConfig(), WrapperConfig interface
└── (no registry/ — PoC files removed in Phase 1)
```

No `src/index.ts` barrel — confirmed removed in Phase 1 (project is CLI-only).

### Pattern 1: Config File Read with Graceful Fallback

**What:** `readWrapperConfig()` reads `.wrapper.json` from `process.cwd()`. Returns empty config object if file missing, throws on malformed JSON.

**When to use:** Called at the top of `main()` in `cli.ts` before command dispatch, or lazily inside `aliasCommand`.

**Recommended behavior when file is missing:** Return a default empty config (`{ aliases: {}, roles: {} }`) and fall through to `printHelp()` rather than crashing. This matches the `readLockFile()` graceful-fallback pattern already established in Phase 1.

```typescript
// Source: project convention (src/registry/lockfile.ts graceful fallback pattern)
export function readWrapperConfig(configPath = CONFIG_FILE_NAME): WrapperConfig {
  try {
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as WrapperConfig;
  } catch {
    // File missing or unparseable → return empty defaults
    return { aliases: {}, roles: {} };
  }
}
```

### Pattern 2: Dynamic Alias Dispatch in cli.ts

**What:** Replace static `if/else` with a config-driven lookup. If `command` matches an alias key, call `aliasCommand(command, remainingArgs)`. Otherwise fall through to built-in commands or `printHelp()`.

**When to use:** `main()` in `cli.ts`, evaluated before built-in command checks so aliases cannot shadow `setup`, `help`, `version`.

```typescript
// Source: project convention (cli.ts dispatch pattern)
const config = readWrapperConfig();
if (command === 'setup') {
  await setupCommand();
} else if (command === 'help' || command === '--help' || command === '-h') {
  printHelp();
} else if (command === 'version' || command === '--version' || command === '-V') {
  console.log('ai-cli-orch-wrapper v0.3.0');
} else if (config.aliases[command]) {
  await aliasCommand(command, config.aliases[command], args.slice(1));
} else {
  console.error(`Error: unknown command '${command}'`);
  printHelp();
  process.exit(1);
}
```

### Pattern 3: cao Passthrough via spawnSync

**What:** `aliasCommand` constructs the `cao launch` argv array and calls `spawnSync('cao', [...])` with `stdio: 'inherit'` so the user sees cao's output directly.

**When to use:** Always — wrapper is a thin dispatch layer, not a pipe.

```typescript
// Source: project convention (setup.ts spawnSync pattern)
import { spawnSync } from 'node:child_process';

export async function aliasCommand(
  aliasName: string,
  entry: AliasEntry,
  passthroughArgs: string[],
): Promise<void> {
  const caoArgs = [
    'launch',
    '--provider', entry.provider,
    '--agents', entry.agent,
    ...passthroughArgs,
  ];
  const result = spawnSync('cao', caoArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
```

### Pattern 4: TypeScript Interfaces for Config Shape

**What:** Typed interfaces for the config file structure. Follows project convention of PascalCase interfaces, no `type` aliases.

```typescript
// Source: project convention (src/registry/types.ts pattern)
export interface AliasEntry {
  provider: string;
  agent: string;
}

export interface WrapperConfig {
  aliases: Record<string, AliasEntry>;
  roles: Record<string, string>;
}
```

### Anti-Patterns to Avoid

- **Shell-based invocation:** Do NOT use `execSync('cao launch ...')` with a shell string — use `spawnSync('cao', [...])` with an array to avoid shell injection and stay consistent with Phase 1.
- **Global config lookup:** Do NOT check `~/.config/wrapper/` — portability principle requires all config in the repo.
- **Inventing a workflow DSL:** The `roles` section stores only provider name strings (e.g., `"claude_code"`). Do NOT encode workflow logic in `.wrapper.json` — that belongs in cao's native flow format (Phase 3).
- **Alias shadowing built-ins:** Built-in commands (`setup`, `help`, `version`) must be checked BEFORE alias lookup so they cannot be overridden by config.
- **Hardcoded provider list:** Do NOT enumerate valid providers in wrapper source. Pass the string directly to `--provider` and let cao validate it. This satisfies CONFIG-02 automatically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| tmux session lifecycle | Custom tmux spawn/attach logic | `cao launch` | cao handles this natively per D-06; wrapper never touches tmux directly |
| Provider validation | Enum/allowlist of provider strings | Pass-through to cao | cao validates `--provider`; wrapper adding a parallel list will drift and break CONFIG-02 |
| Workflow scheduling | Cron/job scheduler | `cao flow` | cao has native scheduled flow management; inventing a parallel system violates CONFIG-03 |
| YAML parsing | Custom line-by-line parser | `js-yaml` (if YAML chosen) or just use JSON | Partial YAML parsers break on edge cases; use the real library or avoid YAML entirely |

**Key insight:** This phase's value is the thin dispatch layer, not any logic wrapper invents. The less wrapper does, the more portable and correct it is.

---

## Runtime State Inventory

> This phase has no rename/refactor scope. No existing runtime state references a string being changed.

Not applicable — Phase 2 is greenfield feature addition (new command handler, new config file). No stored data, live service config, OS-registered state, secrets, or build artifacts are affected.

---

## Common Pitfalls

### Pitfall 1: Module Cache Prevents Config Reload in Tests

**What goes wrong:** Tests that call `setupCommand()` or `readWrapperConfig()` via dynamic `import()` may receive a cached module instance, meaning `process.env.HOME` or `process.cwd()` overrides set after the first import have no effect.

**Why it happens:** Node.js ESM module cache. The Phase 1 tests use dynamic `import('../dist/commands/setup.js')` which hits the cache on repeated calls within a test run.

**How to avoid:** Either (a) resolve the config path at call time inside the function (not at module load time), same as Phase 1's `homedir()` call inside `setupCommand()` rather than at module level, or (b) accept that config-file tests require a temp `.wrapper.json` file written to `process.cwd()` of the test process.

**Warning signs:** Tests pass in isolation but fail when run together; second test in a suite sees first test's config.

### Pitfall 2: spawnSync Returns null status on Signal Kill

**What goes wrong:** `result.status` is `null` when cao is killed by a signal. `process.exit(null)` coerces to `process.exit(0)`, hiding the failure.

**Why it happens:** POSIX signal termination sets `status: null` and `signal: 'SIGTERM'` (or similar) in `spawnSync` result.

**How to avoid:** Use `result.status ?? 1` when passing to `process.exit`. Already noted in the code example above.

**Warning signs:** `wrapper claude` appears to succeed after ctrl-C during a cao session.

### Pitfall 3: config.aliases lookup on undefined command

**What goes wrong:** If `command` is `undefined` (user runs `wrapper` with no args), `config.aliases[undefined]` returns `undefined` rather than throwing, but the dispatch chain falls through to `printHelp()` which is correct. The risk is the opposite: `config.aliases['']` or similar falsy keys matching.

**Why it happens:** JavaScript's `Record<string, V>` lookup on falsy keys is defined behavior (returns `undefined`), but the guard `if (config.aliases[command])` correctly handles this since `undefined` is falsy.

**How to avoid:** The `if (config.aliases[command])` guard (truthiness check) is safe. No extra null check needed.

### Pitfall 4: Existing Test Asserts Stale Comment Text

**What goes wrong:** `test/setup.test.ts` line 40 asserts `content.includes('# Phase 2 will populate CLI alias bindings here.')`. After D-07 (update the placeholder comment), this test will fail.

**Why it happens:** The test was written against the Phase 1 comment text.

**How to avoid:** Update the test assertion when updating `AI_CLI_CONF_CONTENT` in `setup.ts`. This is a required Wave 0 task — the test and the constant must change together.

---

## Code Examples

### .wrapper.json (default bootstrap file)

```json
{
  "aliases": {
    "claude": {
      "provider": "claude_code",
      "agent": "developer"
    },
    "gemini": {
      "provider": "gemini_cli",
      "agent": "developer"
    },
    "codex": {
      "provider": "codex",
      "agent": "developer"
    }
  },
  "roles": {
    "orchestrator": "claude_code",
    "reviewer": "gemini_cli"
  }
}
```

### src/config/wrapper-config.ts

```typescript
/**
 * Wrapper config
 *
 * Reads and parses .wrapper.json from the current working directory.
 */

import { readFileSync } from 'node:fs';

export const CONFIG_FILE_NAME = '.wrapper.json';

export interface AliasEntry {
  provider: string;
  agent: string;
}

export interface WrapperConfig {
  aliases: Record<string, AliasEntry>;
  roles: Record<string, string>;
}

const DEFAULT_CONFIG: WrapperConfig = { aliases: {}, roles: {} };

export function readWrapperConfig(path = CONFIG_FILE_NAME): WrapperConfig {
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as WrapperConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}
```

### src/commands/alias.ts

```typescript
/**
 * Alias command
 *
 * Dispatches a named alias to the corresponding cao launch invocation.
 */

import { spawnSync } from 'node:child_process';
import type { AliasEntry } from '../config/wrapper-config.js';

export async function aliasCommand(
  aliasName: string,
  entry: AliasEntry,
  passthroughArgs: string[],
): Promise<void> {
  const caoArgs = ['launch', '--provider', entry.provider, '--agents', entry.agent, ...passthroughArgs];
  const result = spawnSync('cao', caoArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `if/else` dispatch in `cli.ts` | Config-driven alias lookup | Phase 2 | Adding new aliases requires no code change (ALIAS-02) |
| Hardcoded command list in `printHelp()` | Help output should enumerate config aliases | Phase 2 | `printHelp()` should read config and list available aliases dynamically |

**Deprecated/outdated:**
- Placeholder comment `# Phase 2 will populate CLI alias bindings here.` in `AI_CLI_CONF_CONTENT`: was accurate during Phase 1, now misleading. Replace with neutral text (e.g., `# CLI alias bindings are managed via .wrapper.json in the project root.`).

---

## Open Questions

1. **Should `wrapper setup` scaffold a default `.wrapper.json` if none exists?**
   - What we know: CONTEXT.md D-07/D-08 describe `ai-cli.conf` behavior on re-run but don't specify `.wrapper.json` bootstrapping.
   - What's unclear: Whether `setup` should create the file (discoverability) or leave it to the user to create (explicit is better).
   - Recommendation: Have `wrapper setup` create `.wrapper.json` if it doesn't exist, using the default schema above. Matches the "single command restores full environment" core value. If file already exists, skip (same idempotency pattern as `ai-cli.conf`).

2. **Should `printHelp()` dynamically list aliases from config?**
   - What we know: Current `printHelp()` is static. CONFIG-02 says config supports all providers.
   - What's unclear: Whether listing aliases in help is in scope for Phase 2.
   - Recommendation: Yes — dynamically enumerate `config.aliases` keys in help output. Negligible cost, significantly improves discoverability.

3. **What happens when cao is not on PATH at alias invocation time?**
   - What we know: Phase 1 `setup` validates cao is present at setup time. But setup state is not re-checked on every `wrapper` invocation.
   - What's unclear: Whether `aliasCommand` should re-check cao availability or rely on spawnSync failure.
   - Recommendation: Rely on `spawnSync` failure — `result.error` will be set with `ENOENT` if cao is not found. Check `result.error` and print a friendly message before exiting. No need for a redundant prereq check.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v25.7.0 | — |
| cao | ALIAS-01, ALIAS-02 | ✓ | (version flag not available) | — |
| TypeScript compiler | Build | ✓ | ^5.0.0 (devDep) | — |
| js-yaml | Config parsing (YAML path only) | Not installed | 4.1.1 available on npm | Use JSON format instead (recommended) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `js-yaml`: Not needed if JSON format is chosen (recommended). If YAML is chosen, `npm install js-yaml && npm install --save-dev @types/js-yaml`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) |
| Config file | None — invoked directly via `npm test` |
| Quick run command | `npm run build && node --test test/alias.test.ts` |
| Full suite command | `npm run build && node --test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ALIAS-01 | `wrapper claude` spawns `cao launch --provider claude_code --agents developer` | unit | `npm run build && node --test test/alias.test.ts` | ❌ Wave 0 |
| ALIAS-01 | `wrapper gemini` spawns correct provider | unit | `npm run build && node --test test/alias.test.ts` | ❌ Wave 0 |
| ALIAS-02 | Alias added to `.wrapper.json` is dispatched without code change | unit | `npm run build && node --test test/alias.test.ts` | ❌ Wave 0 |
| CONFIG-01 | `roles` section is parsed and available in returned config object | unit | `npm run build && node --test test/config.test.ts` | ❌ Wave 0 |
| CONFIG-02 | Arbitrary provider string is passed through to cao without validation | unit | `npm run build && node --test test/alias.test.ts` | ❌ Wave 0 |
| CONFIG-03 | Wrapper does not define workflow DSL (structural/review) | manual | code review | — |
| ALIAS-01 | `wrapper <unknown>` exits 1 with error message | unit | `npm run build && node --test test/alias.test.ts` | ❌ Wave 0 |
| SETUP (D-07) | Updated `ai-cli.conf` comment does not contain old Phase 2 placeholder text | unit | `npm run build && node --test test/setup.test.ts` | ✅ (needs update) |

**Note:** The existing `test/setup.test.ts` test at line 40 asserts the OLD placeholder comment text. This test MUST be updated in Wave 0 before any other implementation.

### Sampling Rate

- **Per task commit:** `npm run build && node --test`
- **Per wave merge:** `npm run build && node --test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/alias.test.ts` — covers ALIAS-01, ALIAS-02, CONFIG-02, unknown-alias error path
- [ ] `test/config.test.ts` — covers CONFIG-01 (config read, missing file fallback, malformed JSON fallback)
- [ ] `test/setup.test.ts` line 40 — update assertion to match new `AI_CLI_CONF_CONTENT` text (D-07)

---

## Sources

### Primary (HIGH confidence)

- Direct invocation: `cao launch --help` — confirmed flags: `--agents TEXT` (required), `--provider TEXT`, `--session-name TEXT`, `--headless`, `--yolo`
- Direct invocation: `cao flow --help`, `cao flow add --help` — confirmed flow file format is opaque to wrapper; wrapper does not need to understand it
- Direct invocation: `cao --help` — confirmed command list: `flow`, `info`, `init`, `install`, `launch`, `mcp-server`, `shutdown`
- Source read: `src/cli.ts`, `src/commands/setup.ts`, `test/setup.test.ts` — confirmed existing patterns
- Source read: `package.json` — confirmed zero production dependencies, Node >=18, ESM module type
- npm registry: `npm view js-yaml version` → 4.1.1 (verified 2026-03-24)

### Secondary (MEDIUM confidence)

- CONTEXT.md D-01 through D-11 — user decisions from `/gsd:discuss-phase` session

### Tertiary (LOW confidence)

- None — all claims are directly verifiable from source or live CLI.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps (JSON path); all existing libs confirmed in source
- Architecture: HIGH — patterns directly derived from Phase 1 source code
- Pitfalls: HIGH — Pitfall 4 (test assertion) confirmed by reading test file line 40 directly

**Research date:** 2026-03-24
**Valid until:** 2026-06-24 (stable — cao CLI interface changes are the only drift risk)
