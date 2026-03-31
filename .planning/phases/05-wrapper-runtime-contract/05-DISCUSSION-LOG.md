# Phase 05: Wrapper Runtime Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 05-wrapper-runtime-contract
**Areas discussed:** File naming, Internal branding, Code symbols, Lockfile removal, Subcommand priority

---

## File Naming Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Full Rename | Rename everything to .aco.json, .aco/, etc. | |
| Keep .wrapper | Keep using .wrapper.json, .wrapper/, etc. (Recommended) | ✓ |
| Dual Support | Support both (.aco.json first, fallback to .wrapper.json) | |

**User's choice:** Keep .wrapper (Recommended)
**Notes:** Decided to maintain stable filenames for existing v1.0 repositories while consolidating the command to `aco`.

---

## Internal Branding

| Option | Description | Selected |
|--------|-------------|----------|
| Brand as 'aco' | Use 'aco' in all comments, log messages, and generated file headers | ✓ |
| Keep 'wrapper' Branding | Keep 'wrapper' branding inside the files to match the .wrapper.json filename | |
| Claude's Discretion | Let Claude decide (Mix of both where it makes sense) | |

**User's choice:** Brand as 'aco' (Recommended)
**Notes:** User-facing strings and internal file headers should reflect the canonical command `aco`.

---

## Internal Code Symbols

| Option | Description | Selected |
|--------|-------------|----------|
| Rename Symbols | Rename 'WrapperConfig', 'WrapperCommand' to 'AcoConfig', 'AcoCommand', etc. | ✓ |
| Keep Internals | Keep 'WrapperConfig' internally but map to 'aco' command behavior | |
| Dual Internal Mapping | Use both (deprecate WrapperConfig, add AcoConfig) | |

**User's choice:** Rename Symbols (AcoConfig)
**Notes:** Full refactor of internal symbols to `Aco*` to align with the new branding, while still targeting `.wrapper.json` on disk.

---

## Lockfile Status

| Option | Description | Selected |
|--------|-------------|----------|
| Remove .lock reference | No lockfile needed in v1.1; config and artifacts suffice for now. | ✓ |
| Placeholder Only | Keep the reference but leave it as a future placeholder | |
| Define Now (v1.1) | Define it now (e.g. for workflow run persistence) | |

**User's choice:** Remove .lock reference
**Notes:** `wrapper.lock` is out of scope for v1.1 and its references will be removed to avoid confusion.

---

## Subcommand Priority

| Option | Description | Selected |
|--------|-------------|----------|
| Silent (Built-in Wins) | If user defines 'setup' alias, skip it and use built-in 'setup'. | |
| Warn on Conflict | If user defines 'setup' alias, warn the user on startup | |
| Error on Conflict | If user defines 'setup' alias, exit with an error. | ✓ |

**User's choice:** Error on Conflict
**Notes:** Strict policy to prevent users from accidentally shadowing built-in commands with aliases.

---

## Claude's Discretion
- Exact error message for alias conflicts.
- Specific placement of `aco` branding in logs and file headers.

## Deferred Ideas
- Renaming the physical files `.wrapper.json` and `.wrapper/` to `.aco.*` is deferred to a future major release.
