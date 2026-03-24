# Stack Research

**Domain:** TypeScript/Node.js CLI orchestration wrapper (tmux + AI CLI orchestration)
**Researched:** 2026-03-24
**Confidence:** MEDIUM-HIGH (core stack HIGH, tmux control pattern MEDIUM)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | ^5.4 | Primary language | Project already uses TS5; `@commander-js/extra-typings` requires TS 5.0+; ESM-native workflows align with current Node.js direction |
| Node.js | >=20 LTS | Runtime | Node 20 is the active LTS as of 2025. `execa` v9 and pure-ESM packages require modern Node. Upgrade from current `>=18` floor |
| `commander` | ^13.1 | CLI argument parsing, subcommands | 500M weekly downloads, zero runtime dependencies, 18ms startup vs 48ms for yargs, 135ms for oclif. This wrapper has ~5 subcommands — not complex enough to justify oclif's 30 dependencies |
| `@commander-js/extra-typings` | ^13.1 | Strongly-typed option/action inference | Drop-in overlay over commander; infers narrow types for choices, options, arguments without runtime cost. Requires TS 5.0+ (already satisfied) |
| `execa` | ^9.6 | Shell process execution (tmux CLI, cao CLI, workmux CLI) | Pure-ESM, promise-based, cross-platform Windows shim via `cross-spawn`, automatic zombie-process cleanup, strong TypeScript types. The gold standard for programmatic child_process in 2025. `zx` is an alternative but adds unnecessary shell syntax for a tool that calls known binaries |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `conf` | ^15.1 | User-level config persistence (`~/.config/ai-cli-orch-wrapper/`) | Storing registry URL, installed profile metadata, user preferences across machines. Modern successor to `configstore`; JSON Schema validation built in; XDG-compliant paths |
| `@clack/prompts` | ^0.9 | Interactive CLI prompts + spinner UX | Single-library replacement for inquirer + ora + chalk for prompts. Opinionated, polished styling out of the box. Use for `setup` bootstrap flow and any interactive confirmation steps |
| `chalk` | ^5.4 | Terminal color for non-interactive output | Status messages, error output, diff display outside of prompt flows. Pure-ESM (v5+) aligns with `"type": "module"` in package.json |

### tmux Control Strategy

**No library — use `execa` directly wrapping the `tmux` CLI.**

This is the correct pattern for 2025. All available npm packages for tmux are abandoned:

- `node-tmux` (StarlaneStudios): 7 years since last publish, 8 GitHub stars, 545 weekly downloads — INACTIVE
- `tmuxn` / `@rundik/tmuxn`: niche, low adoption, no active maintenance signal
- `stmux`: re-implements a tmux subset (not a wrapper), wrong abstraction for this use case

The tmux CLI itself is the stable, well-documented API. Control it with `execa`:

```typescript
import { execa } from 'execa';

// Capture pane ID on creation (never use bare indexes)
const { stdout: paneId } = await execa('tmux', [
  'split-window', '-d', '-P', '-F', '#{pane_id}'
]);

// Send command to pane (with small shell-init delay for new panes only)
await execa('tmux', ['send-keys', '-t', paneId.trim(), 'cao run orchestrator', 'Enter']);

// Wait for command completion via tmux channel
const channel = `done-${process.pid}-${Date.now()}`;
await execa('tmux', [
  'send-keys', '-t', paneId.trim(),
  `your-command; tmux wait-for -S ${channel}`, 'Enter'
]);
await execa('tmux', ['wait-for', channel]);
```

Key tmux scripting rules to encode in the wrapper:
- Always capture pane IDs with `#{pane_id}` — never use bare numeric indexes
- Always pass `-d` (detached) to `split-window`/`new-window` to avoid stealing user focus
- Use `tmux wait-for` channels for completion signalling instead of `sleep`
- Write complex commands to a temp file and `source` them to avoid shell quoting issues

### Config / Lockfile Management

No third-party lockfile library needed. Implement a plain JSON lockfile:

```typescript
// ~/.config/ai-cli-orch-wrapper/profiles.lock.json
{
  "lockfileVersion": 1,
  "profiles": {
    "orchestrator": {
      "url": "https://registry.example.com/profiles/orchestrator@1.2.0.md",
      "sha256": "abc123...",
      "installedAt": "2026-03-24T10:00:00Z",
      "localPath": "~/.config/ai-cli-orch-wrapper/profiles/orchestrator.md"
    }
  }
}
```

Use Node.js built-in `fs/promises` + `crypto` (for SHA-256 verification) — no additional library. `conf` handles the config layer; the lockfile is a separate file managed manually for transparency and diffability.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript ^5.4 | Type-checking and compilation | Keep `"strict": true`; add `"moduleResolution": "NodeNext"` and `"module": "NodeNext"` for proper ESM resolution |
| `@types/node` | Node.js built-in type definitions | Already present; bump to `^20.0.0` to match Node 20 LTS floor |
| `tsup` | Build bundler (replaces raw `tsc` for distribution) | Produces clean CJS + ESM dual output, handles shebang injection, much simpler than raw `tsc` for CLI bins. **Optional but recommended** for clean `dist/` output |
| Node.js built-in test runner | Unit testing | Already used in package.json (`"test": "node --test"`). No additional framework needed for a CLI tool this size |

---

## Installation

```bash
# Core runtime
npm install commander @commander-js/extra-typings execa conf @clack/prompts chalk

# Dev dependencies
npm install -D typescript @types/node tsup

# (tsup is optional — use if raw tsc dist/ output becomes unwieldy)
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `commander` | `yargs` | If you need built-in argument coercion, typo suggestions, and deep nested subcommand validation (this wrapper doesn't) |
| `commander` | `oclif` | If the CLI grows to 20+ commands with a plugin system (not the case here) |
| `execa` (wrapping tmux CLI) | Any npm tmux library | Never — all npm tmux libraries are abandoned as of 2025 |
| `execa` | `zx` | If writing shell-heavy scripts with pipes and globs. For this project we call known binaries (`tmux`, `cao`, `workmux`) with known arguments — `execa`'s function-call style is cleaner and safer |
| `conf` | `configstore` | `configstore` is the legacy version; `conf` is its modern successor by the same author |
| `conf` | `cosmiconfig` | `cosmiconfig` is for project-level config discovery (ESLint, Prettier). Wrong tool for user-level CLI preferences |
| `@clack/prompts` | `inquirer` + `ora` + `chalk` | `inquirer` v9+ is ESM-only and broke its plugin ecosystem. `@clack/prompts` gives equivalent UX in one package. Use `inquirer` only if you need custom prompt types (autocomplete, date picker) |
| `tsup` (optional) | raw `tsc` | `tsc` is fine for simple builds; `tsup` pays off when you need dual CJS/ESM output or complex shebang handling |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node-tmux` npm package | Last published 7 years ago, 8 GitHub stars, 545 weekly downloads — abandoned | `execa` wrapping the `tmux` CLI directly |
| `tmuxn` / `@rundik/tmuxn` | Niche YAML session manager, not a programmatic API, low maintenance | `execa` wrapping the `tmux` CLI directly |
| `shelljs` | Synchronous API, slower than `execa`, not promise-native, cross-platform quirks not handled as well | `execa` v9 |
| `chalk` v4 | CommonJS-only in ESM project — will cause import errors with `"type": "module"` | `chalk` v5 (ESM-only) |
| `inquirer` v8 | CommonJS, incompatible with ESM project | `@clack/prompts` or `@inquirer/prompts` (v9+) |
| `oclif` | 30+ dependencies, 135ms startup overhead, framework conventions that fight a small-CLI architecture | `commander` |
| `vorpal` | Abandoned (no updates since 2017) | `commander` |

---

## Stack Patterns by Variant

**If the project remains macOS/Linux only (likely given tmux dependency):**
- `execa`'s cross-platform Windows shim is irrelevant but harmless — no change needed
- No need for PowerShell detection or Windows path normalization

**If tmux interaction complexity grows (e.g., multi-pane layout orchestration):**
- Build a thin `TmuxSession` class wrapping `execa` calls — do NOT reach for an npm library
- Pattern: constructor captures session name, methods return pane IDs, all calls go through `execa('tmux', [...])`

**If the registry protocol becomes complex (e.g., versioned manifests, checksums, metadata):**
- Consider adding `zod` for runtime validation of downloaded registry manifests
- Keep the lockfile format hand-rolled — its simplicity is intentional and makes it diffable in git

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `execa@9.x` | Node.js >=18.19 | Pure ESM; requires `"type": "module"` in package.json (already present) |
| `chalk@5.x` | Node.js >=14.16 | Pure ESM; incompatible with `require()` |
| `commander@13.x` | Node.js >=18 | Built-in TS types; `@commander-js/extra-typings` requires TS 5.0+ |
| `conf@15.x` | Node.js >=18 | Pure ESM; XDG paths on all platforms |
| `@clack/prompts@0.9.x` | Node.js >=14 | ESM |
| `tsup` | TypeScript ^5.0 | Peer dependency; works with project's existing TS version |

All packages in the recommended stack are pure-ESM, consistent with the project's existing `"type": "module"` in `package.json`.

---

## Sources

- npm compare (commander/yargs/oclif download stats, startup benchmarks) — HIGH confidence
- [execa GitHub — sindresorhus/execa](https://github.com/sindresorhus/execa) — HIGH confidence (official)
- [execa v9 release notes](https://medium.com/@ehmicky/execa-9-release-d0d5daaa097f) — HIGH confidence
- [node-tmux Snyk advisor](https://snyk.io/advisor/npm-package/node-tmux) — HIGH confidence (maintenance status verified)
- [tmux scripting patterns — tao-of-tmux](https://tao-of-tmux.readthedocs.io/en/latest/manuscript/10-scripting.html) — HIGH confidence
- [tmux send-keys production patterns](https://tmuxai.dev/tmux-send-keys/) — MEDIUM confidence (community source)
- [commander v13 changelog](https://github.com/tj/commander.js/blob/master/CHANGELOG.md) — HIGH confidence (official)
- [@commander-js/extra-typings](https://github.com/commander-js/extra-typings) — HIGH confidence (official)
- [conf npm page](https://www.npmjs.com/package/conf) — HIGH confidence (v15.1.0 verified)
- [@clack/prompts vs inquirer comparison](https://dev.to/chengyixu/clackprompts-the-modern-alternative-to-inquirerjs-1ohb) — MEDIUM confidence (community)
- [chalk ESM requirements](https://www.npmjs.com/package/chalk) — HIGH confidence
- [zx vs execa comparison](https://tduyng.com/blog/scripting-tools/) — MEDIUM confidence

---

*Stack research for: AI CLI orchestration wrapper (TypeScript/Node.js)*
*Researched: 2026-03-24*
