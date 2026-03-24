# Coding Conventions

**Analysis Date:** 2026-03-24

## Naming Patterns

**Files:**
- kebab-case for all source files: `download.ts`, `lockfile.ts`, `types.ts`
- Commands live in `src/commands/`, registry types and logic in `src/registry/`
- Compiled output mirrors src structure under `dist/`

**Functions:**
- camelCase for all functions: `downloadCommand`, `readLockFile`, `writeLockFile`, `addLockedItem`, `printHelp`
- Command handler functions are named `<name>Command` (e.g., `downloadCommand`)
- Pure utility functions are named by verb+noun: `readLockFile`, `writeLockFile`, `addLockedItem`

**Variables:**
- camelCase: `lockFile`, `lockedItem`, `localPath`, `downloadDir`, `filename`
- Constants are UPPER_SNAKE_CASE: `LOCK_FILE_NAME`, `LOCK_VERSION`

**Types/Interfaces:**
- PascalCase for all interfaces: `LockedItem`, `LockFile`
- Interfaces only (no `type` aliases used in the codebase so far)
- No `I` prefix convention — bare noun names

## Code Style

**Formatting:**
- No Prettier or ESLint config present — formatting is manual/editor-enforced
- 2-space indentation (enforced by TypeScript compiler output)
- Single quotes for string literals
- Trailing commas in object literals

**Linting:**
- `tsc --noEmit` serves as the lint command (configured in `package.json` as `npm run lint`)
- TypeScript `strict: true` is the primary quality gate
- No ESLint or Biome installed

## TypeScript Configuration

- Target: `ES2022`
- Module: `NodeNext` with `moduleResolution: NodeNext`
- `strict: true` — all strict checks enabled
- `declaration: true` and `declarationMap: true` — type declarations emitted for library use
- `sourceMap: true` — source maps emitted
- `resolveJsonModule: true`
- All imports use explicit `.js` extensions (required by NodeNext resolution): `import { ... } from './commands/download.js'`

## Import Organization

**Order (observed pattern):**
1. Node built-in modules with `node:` prefix (`node:fs`, `node:path`)
2. Internal imports with relative paths and `.js` extension

**Path Aliases:**
- None — all imports are relative paths

**Import style:**
- Named imports preferred: `import { mkdirSync, writeFileSync } from 'node:fs'`
- `import type` used for type-only imports: `import type { LockedItem } from '../registry/types.js'`

## Error Handling

**Patterns:**
- `try/catch` blocks in async functions and in I/O functions
- Error discrimination with `instanceof Error` guard: `error instanceof Error ? error.message : String(error)`
- On unrecoverable errors: `console.error(...)` then `process.exit(1)`
- Graceful fallback in `readLockFile`: returns empty default object when file is missing or unparseable rather than throwing
- HTTP errors checked via `response.ok` and thrown as `new Error(...)` with descriptive message

**Pattern for commands:**
```typescript
try {
  // operation
} catch (error) {
  console.error(`Error doing X:`, error instanceof Error ? error.message : String(error));
  process.exit(1);
}
```

**Pattern for library functions:**
```typescript
try {
  // I/O operation
  return result;
} catch {
  return defaultValue; // silent fallback
}
```

## Logging

**Framework:** `console` (native)

**Patterns:**
- `console.log(...)` for progress/success messages
- `console.error(...)` for error messages
- Template literals used for interpolation: `` console.log(`Downloading: ${url}...`) ``
- No structured logging, no log levels, no timestamps

## Comments

**When to Comment:**
- File-level JSDoc blocks on every source file describing the module's purpose
- Inline comments for non-obvious logic (e.g., `// Remove existing entry for the same URL if it exists`)
- No function-level JSDoc on individual exports

**JSDoc/TSDoc:**
```typescript
/**
 * AI CLI Orchestration Wrapper
 *
 * CLI entry point for the lightweight URL downloader.
 */
```
- File-level blocks use two-line format: title line, blank line, description line

## Function Design

**Size:** Functions are small and single-purpose (5–15 lines typical)

**Parameters:**
- Optional parameters use default values: `function readLockFile(path = LOCK_FILE_NAME)`
- Typed parameters always: `url: string`, `lockFile: LockFile`

**Return Values:**
- Explicit return types on all exported functions: `Promise<void>`, `LockFile`, `void`
- `async/await` for all async operations — no raw Promise chains

## Module Design

**Exports:**
- Named exports only — no default exports
- `src/index.ts` re-exports everything via `export * from '...'` barrel pattern

**Barrel Files:**
- `src/index.ts` is the single barrel, re-exporting all public modules
- `src/cli.ts` is the binary entry point (not re-exported)

## Constants

- Module-level constants use UPPER_SNAKE_CASE
- Placed at top of file before function definitions
- Example: `const LOCK_FILE_NAME = 'wrapper.lock'`, `const LOCK_VERSION = '1.0.0'`

---

*Convention analysis: 2026-03-24*
