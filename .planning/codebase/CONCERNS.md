# Codebase Concerns

**Analysis Date:** 2026-03-24

---

## Tech Debt

**Implementation Gap: Prototype vs. Stated Purpose**
- Issue: The codebase is self-described as a "registry resolver" for the SkillInterop JSON-LD catalog, but the entire implementation is a generic URL downloader with no awareness of JSON-LD, `registry-catalog.jsonld`, `index.jsonld`, `hasPart`, or `dataset[]`. The README explicitly acknowledges this: "the code in this repo is not yet aligned with the latest upstream JSON-LD catalogs."
- Files: `src/cli.ts`, `src/commands/download.ts`, `src/registry/lockfile.ts`, `src/registry/types.ts`
- Impact: The CLI cannot perform any of its intended operations (search, install, sync from SkillInterop registries). All documented resolution flows in `docs/registry-resolver.md` and `README.md` are unimplemented.
- Fix approach: Implement the 7-step resolution flow defined in `docs/registry-resolver.md`: fetch hub catalog → parse `hasPart[]` → fetch each leaf `index.jsonld` → normalize `dataset[]` → resolve relative URLs → filter → expose search/install/lock commands.

**Lock File Schema Mismatch**
- Issue: The implemented `LockFile` type in `src/registry/types.ts` uses `{ url, localPath, downloadedAt }` (downloader-era fields). The proposed consumer lock file shape in `docs/lockfile-example.json` uses `{ identifier, registryType, catalogUrl, contentUrl, channel, status, lockedAt }`. These are entirely different structures. The `wrapper.lock` comment in `.gitignore` is also commented out (`# !wrapper.lock`), meaning the lock file is gitignored despite a note saying it should be committed.
- Files: `src/registry/types.ts`, `src/registry/lockfile.ts`, `docs/lockfile-example.json`, `.gitignore` (line 34)
- Impact: Any lock file written by the current code is incompatible with the intended registry-consumer format. Migrating lock files will require a schema version bump and migration logic.
- Fix approach: Replace `LockedItem` interface with the schema shown in `docs/lockfile-example.json`. Add `catalogSource` field to `LockFile`. Add a migration path from the current downloader schema.

**Hard-coded Version String**
- Issue: The version `'ai-cli-orch-wrapper v0.2.0'` is hard-coded in `src/cli.ts` line 25 and is not read from `package.json`. Any version bump in `package.json` will not be reflected in `wrapper version` output without a manual edit to `cli.ts`.
- Files: `src/cli.ts` (line 25), `package.json`
- Impact: Version drift between reported version and actual package version; low-risk today but error-prone as releases continue.
- Fix approach: Read version from `package.json` at runtime using `import { createRequire } from 'module'` or by passing it through the build, rather than hard-coding.

**Hard-coded Download Directory**
- Issue: The download destination `.wrapper/downloads` is hard-coded in `src/commands/download.ts` line 17 with no configuration mechanism. Similarly, the lock file name `wrapper.lock` is hard-coded in `src/registry/lockfile.ts` line 4.
- Files: `src/commands/download.ts` (line 17), `src/registry/lockfile.ts` (line 4)
- Impact: No way for callers to control output location without patching source. Breaks for monorepo or non-root-cwd invocations.
- Fix approach: Accept optional config object or CLI flags for output dir and lock file path.

**No Input Validation on Download URL**
- Issue: `src/commands/download.ts` passes the raw `args[1]` string directly to `new URL(url)` and `fetch(url)` without validating scheme, host, or content type. Only HTTP 4xx/5xx status is checked.
- Files: `src/commands/download.ts` (lines 10-16), `src/cli.ts` (lines 16-21)
- Impact: File-system URLs (`file://`), `javascript:` URIs, or internal network addresses can be passed and will be fetched. Content is written to disk without any sanitization.
- Fix approach: Validate that URL scheme is `https:` (or at minimum `http:`/`https:`). Optionally validate hostname against an allowlist when in registry mode.

**Silent Lock File Corruption**
- Issue: In `src/registry/lockfile.ts` lines 18-23, if the lock file on disk is malformed JSON, the error is silently swallowed and an empty lock file is returned. Any existing locked items are lost without warning.
- Files: `src/registry/lockfile.ts` (lines 15-23)
- Impact: A corrupt or partially-written `wrapper.lock` causes silent data loss of all previously tracked downloads/installs.
- Fix approach: Log a warning to `console.warn` before returning empty state, or propagate the parse error to the caller so they can decide whether to reset or abort.

**`dist/` Committed to Repository**
- Issue: The `.gitignore` lists `dist/` as ignored, but `dist/` is present in the working tree and is tracked by git (evidenced by its presence on the `feat/registry-resolver-foundation` branch). Compiled output should not be committed for a TypeScript source project.
- Files: `.gitignore` (line 5), `dist/` directory
- Impact: `dist/` will diverge from `src/` if developers forget to rebuild. Merge conflicts in generated files. False security of consuming stale compiled code.
- Fix approach: Confirm `dist/` is properly gitignored and run `git rm -r --cached dist/`. Use CI to produce release artifacts.

---

## Known Bugs

**`basename` Returns Empty for Root-Path URLs**
- Symptoms: If a URL has an empty pathname (e.g., `https://example.com` or `https://example.com/`) `basename(new URL(url).pathname)` returns `''` or `'/'`. The fallback `|| 'downloaded-file'` only fires when `basename` returns a falsy value — but `'/'` is truthy, so a file named `/` is passed to `join(downloadDir, '/')`, which resolves to the download directory root rather than a file, causing `writeFileSync` to throw `EISDIR`.
- Files: `src/commands/download.ts` (line 16)
- Trigger: `wrapper download https://example.com/`
- Workaround: None; throws uncaught error from `writeFileSync`.

**`process.exit(1)` Inside Async Catch Suppresses Stack Traces**
- Symptoms: When `downloadCommand` catches an error, it logs `error.message` and calls `process.exit(1)` directly. The top-level `.catch` in `cli.ts` is never reached, and any additional context (stack trace, request details) is discarded.
- Files: `src/commands/download.ts` (line 39), `src/cli.ts` (lines 44-47)
- Trigger: Any fetch failure or file system error during download.
- Workaround: None — callers cannot distinguish error types.

---

## Security Considerations

**Unvalidated URL Scheme Allows SSRF-Adjacent Behavior**
- Risk: The `fetch(url)` call in `src/commands/download.ts` accepts any URL string, including `file://` paths (on some runtimes), internal IPs, and link-local addresses. This is a Server-Side Request Forgery pattern in a local CLI context — it could be used to exfiltrate local file contents if the CLI is invoked by an automated system or script that passes untrusted URLs.
- Files: `src/commands/download.ts` (lines 10-12)
- Current mitigation: None.
- Recommendations: Validate URL protocol is `https:` before fetching. Optionally reject private/loopback IP ranges.

**Lock File Written Without Atomic Replace**
- Risk: `writeFileSync` in `src/registry/lockfile.ts` line 27 writes directly to `wrapper.lock`. If the process is interrupted mid-write, the lock file is left partially written and the silent-swallow catch in `readLockFile` returns empty state, losing all lock entries.
- Files: `src/registry/lockfile.ts` (lines 26-28)
- Current mitigation: None.
- Recommendations: Write to a temp file first, then `fs.renameSync` to `wrapper.lock` for atomicity.

**Downloaded Content Written Without Integrity Verification**
- Risk: Files are fetched and written to disk with no checksum or hash verification. A man-in-the-middle or a compromised upstream URL could serve malicious content that is silently written and potentially executed.
- Files: `src/commands/download.ts` (lines 15-24)
- Current mitigation: None. HTTPS is not even enforced.
- Recommendations: For registry use, store a `sha256` or similar hash in the lock file at install time and verify on subsequent reads.

---

## Performance Bottlenecks

**No Concurrency for Multi-Item Downloads**
- Problem: The intended registry resolution flow (fetch hub → fetch N leaf catalogs → fetch N content documents) is a sequential waterfall with no parallelism in the current prototype.
- Files: `src/commands/download.ts`
- Cause: Single `await fetch(url)` per invocation, no batching.
- Improvement path: Use `Promise.all` or a concurrency-limited queue (e.g., `p-limit`) when implementing the multi-leaf registry fetch loop.

---

## Fragile Areas

**`src/index.ts` Re-exports Everything Indiscriminately**
- Files: `src/index.ts`
- Why fragile: `export * from './registry/types.js'`, `export * from './registry/lockfile.js'`, `export * from './commands/download.js'` — all internal implementation details are public API. As the module grows, adding internal functions risks accidental surface area exposure and semver breaks.
- Safe modification: Explicitly name exports in `src/index.ts` rather than using barrel re-exports.
- Test coverage: None.

**CLI Argument Parsing is Hand-Rolled**
- Files: `src/cli.ts`
- Why fragile: Argument handling uses raw `process.argv.slice(2)` array indexing. There is no flag parser, so adding optional flags (e.g., `--output-dir`, `--channel`, `--dry-run`) requires manual index arithmetic that is error-prone.
- Safe modification: Introduce a minimal arg-parser (e.g., Node's built-in `parseArgs` from `node:util`) before adding new commands or flags.
- Test coverage: None.

**`readLockFile` Silently Resets on Parse Error**
- Files: `src/registry/lockfile.ts` (lines 15-23)
- Why fragile: Any JSON parse failure (disk corruption, partial write, encoding issue) silently returns an empty lock file. Subsequent `addLockedItem` + `writeLockFile` calls then overwrite the corrupted but potentially recoverable file with empty state.
- Safe modification: Back up the corrupted file before resetting, and emit a warning.
- Test coverage: None.

---

## Scaling Limits

**Lock File as Flat JSON Array**
- Current capacity: Adequate for tens of items.
- Limit: The lock file is read fully into memory on every operation (`readLockFile`), modified in-place as an array, and written back in full. For large registries with hundreds or thousands of entries, this becomes a read-modify-write bottleneck.
- Scaling path: If lock file grows large, switch to a database (SQLite via `better-sqlite3`) or a keyed index structure to enable O(1) lookups rather than `.filter()` array scans.

---

## Dependencies at Risk

**Zero Runtime Dependencies**
- Risk: The project uses only Node built-ins (`fs`, `path`) and the built-in `fetch` (Node 18+). While this is architecturally clean, implementing the full registry resolver will require JSON-LD parsing, URL resolution, and possibly schema validation. Grafting these onto a zero-dependency codebase without a defined strategy will lead to ad-hoc parsing code.
- Impact: JSON-LD `@context`, `@type`, `hasPart`, and relative URL resolution have edge cases that hand-rolled parsers will miss.
- Migration plan: Evaluate `jsonld` (npm) for catalog parsing or implement a minimal subset parser with clearly documented limitations.

**Node 18+ Minimum for Built-in `fetch`**
- Risk: `src/commands/download.ts` relies on the global `fetch` introduced in Node 18. The `engines` field in `package.json` correctly specifies `"node": ">=18.0.0"`, but there is no runtime check — if invoked on Node 16, the error message will be `fetch is not defined`, which is cryptic.
- Impact: Poor DX for users on older Node versions.
- Migration plan: Add a startup version check in `src/cli.ts` with a clear error message, or polyfill with `node-fetch` for broader compatibility.

---

## Missing Critical Features

**No Search, Install, or Sync Commands**
- Problem: The CLI exposes only `download <url>`, `help`, and `version`. The entire registry-consumer workflow (search by name/type/channel, install from registry, sync/update locked items) is absent.
- Blocks: The project cannot be used for its stated purpose of consuming SkillInterop registries.

**No Registry-Aware Lock File**
- Problem: The current `wrapper.lock` tracks only `{ url, localPath, downloadedAt }`. It has no concept of `identifier`, `registryType`, `channel`, `status`, or `catalogSource` — all of which are required to implement idempotent install and upgrade flows against the upstream JSON-LD catalogs.
- Blocks: Reproducible installs, channel pinning, status filtering.

**No Error Recovery or Rollback**
- Problem: If a download or install fails mid-way, there is no cleanup of partial files or partial lock file updates. `process.exit(1)` is called immediately without any cleanup handlers.
- Blocks: Reliable use in CI/automation contexts.

---

## Test Coverage Gaps

**Zero Test Files**
- What's not tested: Every module — `downloadCommand`, `readLockFile`, `writeLockFile`, `addLockedItem`, CLI argument dispatch.
- Files: `src/commands/download.ts`, `src/registry/lockfile.ts`, `src/registry/types.ts`, `src/cli.ts`
- Risk: Any refactor or new feature risks silent regressions with no safety net. The `"test": "node --test"` script in `package.json` runs no tests today (no test files exist).
- Priority: High — especially for lock file read/write logic and URL validation once implemented.

---

*Concerns audit: 2026-03-24*
