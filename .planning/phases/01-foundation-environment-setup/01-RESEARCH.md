# Phase 1: Foundation + Environment Setup - Research

**Researched:** 2026-03-24
**Domain:** Node.js CLI, TypeScript, file system ops, tmux conf injection
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Delete `download.ts`, `lockfile.ts`, `types.ts`, `index.ts` entirely — all are unrelated download PoC code.
- **D-02:** Rewrite `cli.ts` from scratch. Phase 1 only exposes the `setup` command (plus `help` and `version`). No other commands.
- **D-03:** No library barrel export (`src/index.ts` removed) — this project is a CLI tool only.
- **D-04:** On startup of `wrapper setup`, check for `cao`, `tmux`, and `workmux` via PATH lookup.
- **D-05:** Error format: tool names only — `Error: missing prerequisites: cao, workmux`. No install URLs. Exit with non-zero code.
- **D-06:** All missing tools listed in a single error message (not one error per tool).
- **D-07:** If `~/.tmux.conf` does not exist, auto-create it with only the `source-file` line.
- **D-08:** `~/.config/tmux/ai-cli.conf` is written with a comment header only in Phase 1. Phase 2 populates it.
- **D-09:** Idempotency check: before injecting `source-file` line, scan `~/.tmux.conf` for existing line pointing to `~/.config/tmux/ai-cli.conf`. If found, skip injection.
- **D-10:** Both first run and re-run use the same `[✓]` checkmark summary format. No silent success.
- **D-11:** Phase 1 does NOT create a wrapper config file. That is Phase 2's responsibility.

### Claude's Discretion

- Exact mechanism for PATH lookup (Node.js `child_process.execSync('command -v cao')` vs `which` vs `spawnSync`)
- Exact `source-file` line format — use `source-file` for broader tmux version compatibility
- `~/.config/tmux/` directory creation if it doesn't exist

### Deferred Ideas (OUT OF SCOPE)

- Wrapper config file (CLI alias/role mappings) — Phase 2
- Populating `ai-cli.conf` with actual tmux content — Phase 2
- `wrapper worktree` subcommands — Phase 2 / v2 scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETUP-01 | User can run `wrapper setup` to bootstrap the full environment with a single command | `setupCommand()` in `src/commands/setup.ts` wired to `cli.ts`; `npm run build` produces `dist/cli.js` |
| SETUP-02 | `wrapper setup` is idempotent — safe to re-run without side effects | Idempotency via file-existence checks and line-scan before injection (D-09); `[✓] already exists / already configured` output path |
| SETUP-03 | Checks for prerequisites and exits with clear error if any are missing | `spawnSync('which', [tool])` pattern verified; collect all missing, emit single error, `process.exit(1)` |
| SETUP-04 | Writes `~/.config/tmux/ai-cli.conf` and injects exactly one `source-file` line into `~/.tmux.conf` | `fs.mkdirSync` + `fs.writeFileSync` for conf; `fs.readFileSync` + includes check + `fs.appendFileSync` for injection |
</phase_requirements>

---

## Summary

Phase 1 is a focused TypeScript CLI rewrite. The existing `src/` tree is a URL-downloader proof-of-concept with no code worth carrying forward except `cli.ts`'s structural shell (argv parsing, `main()`, `process.exit(1)` error handling). Everything in `src/commands/` and `src/registry/` is deleted. The rewrite produces a single new command — `setup` — that validates prerequisites, writes a tmux config stub, and injects a `source-file` line into `~/.tmux.conf`.

The technical surface is narrow and entirely covered by Node.js built-ins: `node:fs`, `node:path`, `node:os`, and `node:child_process`. No new npm dependencies are introduced. The hardest design concern is correct idempotency — specifically the line-scan for the `source-file` injection, which must handle the case where the line exists in varied whitespace forms or as a comment.

`spawnSync('which', [tool])` is the correct PATH-lookup mechanism for this project's macOS/Linux target: it is available in all Node.js >=18 versions, returns exit code 0 for found and 1 for missing, requires no shell interpolation, and avoids the security concerns of `execSync('command -v ...')`.

**Primary recommendation:** Implement `src/commands/setup.ts` as a single async function `setupCommand()` using only Node built-ins; keep `src/cli.ts` as the sole entry point; delete all other `src/` files.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.0.0 (devDep, already installed) | Source language | Project-established; `tsconfig.json` already correct |
| `@types/node` | ^20.0.0 (devDep, already installed) | Node.js type definitions | Required for `fs`, `path`, `os`, `child_process` types |
| `node:fs` | built-in | File read/write/mkdir | Standard for file operations; no alternative needed |
| `node:path` | built-in | Path construction | Cross-platform path joining |
| `node:os` | built-in | `os.homedir()` for `~` expansion | Correct way to resolve `~` in Node.js |
| `node:child_process` | built-in | `spawnSync` for PATH lookup | Verified: `spawnSync('which', [tool])` exits 0=found, 1=missing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node --test` (built-in) | Node.js 25.7.0 | Test runner | Already configured via `npm test`; add test files in `src/` or `test/` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `spawnSync('which', [tool])` | `execSync('command -v tool')` | `execSync` requires shell=true, introduces shell-injection surface; `spawnSync` is safer and no shell needed |
| `spawnSync('which', [tool])` | `fs.accessSync(path, fs.constants.X_OK)` over `PATH.split(':')` | More code for same result; `which` handles PATH resolution reliably |
| `fs.appendFileSync` for `source-file` injection | Full file rewrite | Rewrite risks corrupting existing `~/.tmux.conf`; append after idempotency check is safer |

**Installation:** No new packages required. All dependencies already present.

**Verified versions (npm registry, 2026-03-24):** `typescript` current is 5.8.x; project pins `^5.0.0` which resolves to latest 5.x — correct. `@types/node` current is 22.x; project pins `^20.0.0` which resolves to latest 20.x — sufficient for all APIs used.

---

## Architecture Patterns

### Recommended Project Structure (post-rewrite)

```
src/
├── cli.ts            # Entry point: argv parsing, dispatch, help, version
└── commands/
    └── setup.ts      # setupCommand(): prereq check + tmux conf bootstrap
```

All other files in `src/` are deleted (`src/commands/download.ts`, `src/registry/lockfile.ts`, `src/registry/types.ts`, `src/index.ts`).

### Pattern 1: Command Dispatch in cli.ts

**What:** Minimal argv dispatcher that calls one command handler and exits.
**When to use:** This is the established pattern already in `src/cli.ts` — preserve the structure.

```typescript
// src/cli.ts
#!/usr/bin/env node

/**
 * AI CLI Orchestration Wrapper
 *
 * CLI entry point — dispatches to command handlers.
 */

import { setupCommand } from './commands/setup.js';

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  if (command === 'setup') {
    await setupCommand();
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
  } else if (command === 'version' || command === '--version' || command === '-V') {
    console.log('ai-cli-orch-wrapper v0.2.0');
  } else {
    printHelp();
  }
}

function printHelp(): void {
  console.log(`
ai-cli-orch-wrapper - AI CLI orchestration environment setup

Usage: wrapper <command>

Commands:
  setup    Bootstrap the AI CLI orchestration environment
  help     Show this help
  version  Show version
`);
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

### Pattern 2: PATH Lookup via spawnSync

**What:** Use `spawnSync('which', [toolName])` with `encoding: 'utf8'` — exit status 0 means found, non-zero means not found.
**When to use:** Any prerequisite check in Node.js targeting macOS/Linux.

```typescript
// Source: verified locally — spawnSync('which', ['tmux']) → status 0 on macOS
import { spawnSync } from 'node:child_process';

function isOnPath(tool: string): boolean {
  const result = spawnSync('which', [tool], { encoding: 'utf8' });
  return result.status === 0;
}

const tools = ['cao', 'tmux', 'workmux'];
const missing = tools.filter(t => !isOnPath(t));
if (missing.length > 0) {
  console.error(`Error: missing prerequisites: ${missing.join(', ')}`);
  process.exit(1);
}
```

### Pattern 3: Idempotent File Write

**What:** Check file existence before writing; report correct status either way.
**When to use:** `~/.config/tmux/ai-cli.conf` creation.

```typescript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const tmuxConfigDir = join(homedir(), '.config', 'tmux');
const aiCliConf = join(tmuxConfigDir, 'ai-cli.conf');

if (existsSync(aiCliConf)) {
  console.log('[✓] ~/.config/tmux/ai-cli.conf: already exists');
} else {
  mkdirSync(tmuxConfigDir, { recursive: true });
  writeFileSync(aiCliConf, [
    '# ai-cli-orch-wrapper tmux config',
    '# Managed by wrapper setup — do not edit manually.',
    '# Phase 2 will populate CLI alias bindings here.',
    '',
  ].join('\n'), 'utf8');
  console.log('[✓] ~/.config/tmux/ai-cli.conf written');
}
```

### Pattern 4: Idempotent source-file Injection

**What:** Scan `~/.tmux.conf` for an existing line referencing `ai-cli.conf`. If absent, append. If `~/.tmux.conf` does not exist, create it with just the line.
**When to use:** SETUP-04 tmux conf injection.

```typescript
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const tmuxConf = join(homedir(), '.tmux.conf');
const sourceTarget = join(homedir(), '.config', 'tmux', 'ai-cli.conf');
const sourceLine = `source-file ${sourceTarget}`;

if (!existsSync(tmuxConf)) {
  writeFileSync(tmuxConf, sourceLine + '\n', 'utf8');
  console.log('[✓] ~/.tmux.conf: source line added');
} else {
  const content = readFileSync(tmuxConf, 'utf8');
  if (content.includes(sourceTarget)) {
    console.log('[✓] ~/.tmux.conf: already configured');
  } else {
    appendFileSync(tmuxConf, '\n' + sourceLine + '\n', 'utf8');
    console.log('[✓] ~/.tmux.conf: source line added');
  }
}
```

### Anti-Patterns to Avoid

- **Overwriting `~/.tmux.conf` entirely:** Destroys user's existing tmux configuration. Use `appendFileSync` only.
- **Using `execSync('command -v cao')` without `shell: true`:** `command` is a shell builtin, not an executable — it silently fails. Use `spawnSync('which', [...])` instead.
- **Expanding `~` with string replacement:** `'~'.replace('~', ...)` is fragile. Always use `os.homedir()`.
- **Hardcoding `source-file` path as a string literal:** Construct the path with `path.join(os.homedir(), ...)` so it resolves correctly on any machine.
- **Checking for `source-file` line by exact string match:** Use `.includes(sourceTarget)` (the path part), not a full-line match, to tolerate minor formatting variations in the file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Home directory resolution | `process.env.HOME` or `'~'` string | `os.homedir()` | `HOME` may be unset or wrong in some environments; `os.homedir()` is always correct |
| Recursive directory creation | Manual `mkdir` loop | `fs.mkdirSync(path, { recursive: true })` | Built-in; handles already-exists case without throwing |
| Cross-platform PATH lookup | Custom `PATH.split(':')` walker | `spawnSync('which', [tool])` | `which` handles `PATH`, symlinks, and exec bits correctly on all POSIX systems |

**Key insight:** Every operation in this phase has a correct one-liner in Node.js built-ins. The risk is reaching for shell commands or manual logic where a Node API already handles the edge cases.

---

## Common Pitfalls

### Pitfall 1: `command -v` requires a real shell

**What goes wrong:** `spawnSync('command', ['-v', 'cao'])` silently fails — `command` is a shell builtin, not a binary.
**Why it happens:** Developers assume shell builtins are executables. `spawnSync` without `shell: true` does not invoke a shell.
**How to avoid:** Use `spawnSync('which', [toolName])` — `which` is a real binary on macOS/Linux. Alternatively use `spawnSync('sh', ['-c', `command -v ${tool}`])` with proper quoting, but `which` is simpler and equally reliable here.
**Warning signs:** `spawnSync` returns `status: null` and `error: ENOENT` — the executable was not found.

### Pitfall 2: `~/.tmux.conf` injection duplicates on re-run

**What goes wrong:** Each `wrapper setup` call appends another `source-file` line, creating duplicates that tmux logs as errors.
**Why it happens:** Forgetting the idempotency scan before `appendFileSync`.
**How to avoid:** Read the file, check `content.includes(sourceTarget)`, only append if not found (D-09).
**Warning signs:** Running `wrapper setup` twice produces two `[✓] ~/.tmux.conf: source line added` messages instead of the second being `already configured`.

### Pitfall 3: `mkdirSync` throws if directory already exists

**What goes wrong:** `mkdirSync('~/.config/tmux')` throws `EEXIST` if the directory is already there.
**Why it happens:** Omitting the `{ recursive: true }` option.
**How to avoid:** Always pass `{ recursive: true }` — it is a no-op when the directory exists.
**Warning signs:** Unhandled exception on re-run when `~/.config/tmux/` already exists from a previous setup.

### Pitfall 4: NodeNext module resolution requires `.js` extensions

**What goes wrong:** `import { setupCommand } from './commands/setup'` fails at runtime with `ERR_MODULE_NOT_FOUND`.
**Why it happens:** `module: NodeNext` + `moduleResolution: NodeNext` requires explicit `.js` extensions in import paths (the compiled output extension).
**How to avoid:** Always write `import { setupCommand } from './commands/setup.js'` — the `.js` extension is required even though the source file is `.ts`.
**Warning signs:** `tsc --noEmit` (lint) passes but `node dist/cli.js` crashes.

### Pitfall 5: Deleting src/ files while import references remain

**What goes wrong:** Deleting `src/commands/download.ts` while `src/cli.ts` still imports from it causes `tsc` to fail.
**Why it happens:** File deletion and import cleanup done in wrong order.
**How to avoid:** Rewrite `cli.ts` first (removing the `download` import), then delete the old files. Or delete all old files and write new ones in the same task.

---

## Code Examples

### Verified: spawnSync for tool detection

```typescript
// Verified on macOS with Node.js v25.7.0
import { spawnSync } from 'node:child_process';

function isOnPath(tool: string): boolean {
  const result = spawnSync('which', [tool], { encoding: 'utf8' });
  return result.status === 0;
}
```

### Verified: os.homedir() usage

```typescript
import { homedir } from 'node:os';
import { join } from 'node:path';

const tmuxConf = join(homedir(), '.tmux.conf');
// → '/Users/username/.tmux.conf' on macOS
// → '/home/username/.tmux.conf' on Linux
```

### Verified: mkdirSync recursive (no-op if exists)

```typescript
import { mkdirSync } from 'node:fs';
mkdirSync('/some/nested/dir', { recursive: true }); // safe even if already exists
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + runtime | Yes | v25.7.0 | — |
| npm | Build | Yes | 11.10.1 | — |
| TypeScript (tsc) | Build (`npm run build`) | Yes (local devDep) | ^5.0.0 | `npx tsc` |
| tmux | SETUP-04 target; prereq check | Yes | 3.6a | — |
| cao | SETUP-03 prereq check | Yes | unknown (no --version flag) | — |
| workmux | SETUP-03 prereq check | Yes | 0.1.140 | — |

**Notes:**
- `cao` has no `--version` flag — this is expected behavior, not a problem. PATH lookup via `which cao` succeeds (path: `/Users/pureliture/.local/bin/cao`). The prereq check only needs PATH presence, not version.
- `tsc` is not globally available but is installed as a devDependency. `npm run build` (which calls `tsc`) works correctly.

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | None — invoked via `npm test` → `node --test` |
| Quick run command | `node --test` |
| Full suite command | `npm test` |

**Note:** `node:test` is confirmed available in the active Node.js v25.7.0 environment.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETUP-01 | `wrapper setup` runs and exits 0 on a configured machine | smoke | `node --test test/setup.test.js` | No — Wave 0 |
| SETUP-02 | Second run of `wrapper setup` exits 0, no side effects | unit | `node --test test/setup.test.js` | No — Wave 0 |
| SETUP-03 | Missing prerequisites cause exit 1 with correct message | unit | `node --test test/setup.test.js` | No — Wave 0 |
| SETUP-04 | `ai-cli.conf` written; `source-file` line injected once | unit | `node --test test/setup.test.js` | No — Wave 0 |

**Note on SETUP-01/02/04:** These interact with the real filesystem (`~/.tmux.conf`, `~/.config/tmux/`). Tests should use a temp directory fixture (set `HOME` env var to a temp dir in test scope) to avoid touching the real user home directory.

### Sampling Rate

- **Per task commit:** `node --test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/setup.test.js` — covers SETUP-01 through SETUP-04; needs temp-HOME fixture pattern
- [ ] Framework install: none needed — `node:test` is built-in

---

## Open Questions

1. **cao version detection**
   - What we know: `cao --version` returns nothing; `which cao` succeeds (tool is present)
   - What's unclear: Whether future phases need to assert a minimum cao version
   - Recommendation: Phase 1 only checks presence, not version — consistent with D-04. No action needed now.

2. **tmux `source-file` vs `source` keyword**
   - What we know: CONTEXT.md D-09 specifies using `source-file` for broader tmux version compatibility
   - What's unclear: At what tmux version `source` (shorthand) was introduced
   - Recommendation: Use `source-file` — it works in all tmux versions including 1.x. Current env has 3.6a but portability is the project's core value.

---

## Sources

### Primary (HIGH confidence)

- Node.js v25.7.0 runtime — `spawnSync` behavior verified by direct execution
- `node:test` availability — verified by `require('node:test')` in the active environment
- `tsconfig.json` in project root — TypeScript configuration verified by reading
- `package.json` in project root — scripts, bin, and devDependencies verified by reading

### Secondary (MEDIUM confidence)

- tmux documentation convention — `source-file` vs `source` compatibility based on tmux project's documented history (pre-2.x used only `source-file`)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are Node built-ins already in use; no external packages added
- Architecture: HIGH — pattern directly derived from locked decisions in CONTEXT.md and verified Node.js APIs
- Pitfalls: HIGH — all pitfalls verified by local execution or direct reading of TypeScript/Node docs

**Research date:** 2026-03-24
**Valid until:** 2026-06-24 (stable Node.js APIs; 90-day estimate)
