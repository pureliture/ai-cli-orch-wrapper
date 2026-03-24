# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

**Runner:**
- Node.js built-in test runner (`node --test`)
- No external test framework (Jest, Vitest, Mocha, etc.) installed
- Config: none — invoked directly via `npm test` which runs `node --test`

**Assertion Library:**
- Node.js built-in `node:assert` (implied by use of `node --test`)

**Run Commands:**
```bash
npm test          # Run all tests (node --test)
npm run lint      # Type-check without emit (tsc --noEmit)
npm run build     # Compile TypeScript to dist/
```

## Test File Organization

**Location:**
- No test files exist in the codebase at this time
- The test runner (`node --test`) will auto-discover files matching `**/*.test.{js,mjs,cjs}` or `**/*.spec.{js,mjs,cjs}` when run without arguments

**Naming (prescribed by Node test runner convention):**
- Co-locate test files with source: `src/registry/lockfile.test.ts`
- Or use a `__tests__/` directory at the same level as the module under test
- File pattern: `<module-name>.test.ts`

**Structure (prescribed):**
```
src/
├── commands/
│   ├── download.ts
│   └── download.test.ts       # co-locate with source
├── registry/
│   ├── lockfile.ts
│   ├── lockfile.test.ts
│   └── types.ts
└── cli.ts
```

## Test Structure

**Suite Organization (Node built-in pattern to follow):**
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('readLockFile', () => {
  it('returns empty lockfile when file does not exist', () => {
    // arrange
    // act
    // assert
    assert.deepStrictEqual(result, expected);
  });

  it('returns default when file is malformed JSON', () => {
    // ...
  });
});
```

**Patterns:**
- Arrange / Act / Assert structure (no formal setup observed yet, but implied by function signatures)
- Default parameter on `readLockFile(path = LOCK_FILE_NAME)` enables test injection without mocking: pass a temp path
- `writeLockFile(lockFile, path)` similarly accepts an injectable path parameter

## Mocking

**Framework:** Node.js built-in `node:test` mock utilities (`mock.fn`, `mock.method`, `mock.module`)

**Patterns (prescribed based on codebase structure):**
```typescript
import { mock } from 'node:test';
import { readFileSync } from 'node:fs';

// Mock a module method
mock.method(globalThis, 'fetch', async () => ({
  ok: true,
  statusText: 'OK',
  text: async () => 'file contents',
}));

// Restore after test
mock.restoreAll();
```

**What to Mock:**
- `fetch` (global) — used in `downloadCommand` for HTTP calls; `src/commands/download.ts` line 10
- `node:fs` functions (`mkdirSync`, `writeFileSync`) when testing download side effects
- File system paths — prefer injecting temp paths via the optional `path` parameter on `readLockFile`/`writeLockFile`

**What NOT to Mock:**
- `readLockFile` / `writeLockFile` / `addLockedItem` — these are pure or near-pure functions testable with real temp files
- `URL` parsing — use real URLs in unit tests

## Fixtures and Factories

**Test Data (prescribed pattern):**
```typescript
import type { LockFile, LockedItem } from '../registry/types.js';

function makeLockFile(overrides: Partial<LockFile> = {}): LockFile {
  return {
    lockVersion: '1.0.0',
    items: [],
    ...overrides,
  };
}

function makeLockedItem(overrides: Partial<LockedItem> = {}): LockedItem {
  return {
    url: 'https://example.com/file.md',
    localPath: '.wrapper/downloads/file.md',
    downloadedAt: new Date().toISOString(),
    ...overrides,
  };
}
```

**Location:**
- No fixtures directory exists yet
- Recommend: `src/__fixtures__/` for shared test data, or inline factories per test file

## Coverage

**Requirements:** None enforced — no coverage threshold configured

**View Coverage:**
```bash
node --test --experimental-test-coverage    # Node 22+ built-in coverage
```

No `c8`, `nyc`, or `istanbul` installed.

## Test Types

**Unit Tests:**
- Primary target for this codebase
- Scope: individual functions in `src/registry/lockfile.ts` and `src/commands/download.ts`
- `addLockedItem`, `readLockFile`, `writeLockFile` are pure/side-effecting functions with injectable paths — ideal for unit testing with temp files

**Integration Tests:**
- Not present
- Would test `downloadCommand` end-to-end with a real or mocked HTTP server

**E2E Tests:**
- Not used
- Could invoke `node dist/cli.js download <url>` as a subprocess

## Common Patterns

**Testing file I/O with temp paths:**
```typescript
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Create isolated temp dir per test
const dir = mkdtempSync(join(tmpdir(), 'wrapper-test-'));
const lockPath = join(dir, 'wrapper.lock');

// Use injectable path parameter
const result = readLockFile(lockPath);

// Cleanup
rmSync(dir, { recursive: true });
```

**Async Testing:**
```typescript
import { it } from 'node:test';

it('downloads a file', async () => {
  // mock fetch, then await downloadCommand(url)
  await downloadCommand('https://example.com/test.md');
  // assert file written and lockfile updated
});
```

**Error Testing:**
```typescript
import { it } from 'node:test';
import assert from 'node:assert/strict';

it('throws on bad HTTP response', async () => {
  // mock fetch to return ok: false
  await assert.rejects(
    () => downloadCommand('https://example.com/missing'),
    /Failed to fetch/,
  );
});
```

## Notes

- No tests exist in the codebase. The test infrastructure (`node --test`) is configured via `package.json` scripts but no test files have been authored yet.
- The codebase is structured for testability: optional path parameters on I/O functions avoid hard-coded global state, enabling test isolation without complex mocking.
- TypeScript source must be compiled before running tests (tests would target `dist/` or use a loader like `tsx`). Consider adding `tsx` or `ts-node` as a dev dependency to run tests directly against source.

---

*Testing analysis: 2026-03-24*
