## Review Issues: prevent-external-skill-command-duplication

Discovered during code review of commit `35fac46`.
Status: Open — batch-improve later.

---

### Issue 1: OpenSpec external duplicate scenario incomplete (Spec Gap) 🔴

**Location**: `packages/wrapper/src/sync/duplicate-detector.ts`
**Spec reference**: `specs/external-provider-surface-guardrails/spec.md`

**Description**:
The spec describes a scenario where `.gemini/commands/opsx/apply.toml`, `.codex/skills/openspec-apply-change/SKILL.md`, and `.agents/skills/openspec-apply-change/SKILL.md` should all be flagged as a duplicate for provider `openspec`.

However, `detectDuplicates()` groups by `${provider}:${name}` key:
- `.gemini/commands/opsx/apply.toml` → key `gemini:opsx/apply`
- `.agents/skills/openspec-apply-change/` → key `gemini:openspec-apply-change`
- `.codex/skills/openspec-apply-change/` → key `codex:openspec-apply-change`

Because the names differ (`opsx/apply` ≠ `openspec-apply-change`), they are classified under different keys and **no duplicate warning is emitted**.

**Impact**: The spec promises provider-level external-asset duplicate detection across differently-named surfaces, but the implementation only detects same-name collisions.

**Suggested fix**: Either (a) add provider-level grouping for `isOpenSpec || isSuperpowers` assets regardless of exact name, or (b) adjust the spec to reflect that duplicate detection is currently name-based only.

---

### Issue 2: Cleanup target extraction relies on message parsing (Fragile) 🟡

**Location**: `packages/wrapper/src/sync/sync-engine.ts:145`

**Description**:
```ts
const match = warning.message.match(/Cleanup target: (.+)/);
```

The `cleanDuplicates` logic parses the human-readable `warning.message` string with a regex to extract the cleanup target path. If `duplicate-detector.ts` ever changes its message format, this will silently fail to clean up anything.

**Impact**: Silent failure on message format change. No compile-time or test-time validation of the contract between detector and cleaner.

**Suggested fix**: Add a structured `cleanupTargets?: string[]` field to the `SyncWarning` interface. Populate it in `duplicate-detector.ts` and read it directly in `sync-engine.ts` instead of parsing prose.

---

### Issue 3: `parseSyncConfig` is a hand-rolled YAML subset parser (Technical Debt) 🟡

**Location**: `packages/wrapper/src/sync/sync-config.ts:33-73`

**Description**:
The current parser only supports simple dash-prefixed list items under `skills:` → `include:` / `exclude:`. It does **not** support:
- Inline lists (`include: [a, b, c]`)
- Quoted strings containing `:` or `#`
- Nested objects
- YAML anchors/aliases

`js-yaml` is already available as a dependency (used in tests at `tests/sync.test.ts`).

**Impact**: Users may write valid YAML that is silently mis-parsed or skipped. Maintenance burden of keeping a partial parser in sync with real YAML syntax.

**Suggested fix**: Replace the hand-rolled parser with `js-yaml.load()` or `yaml.parse()`. Keep the return type `SyncConfig` stable.

---

### Issue 4: Path splitting assumes Unix-style separators (Portability) 🟡

**Location**: `packages/wrapper/src/sync/skill-classifier.ts:37-40`

**Description**:
```ts
const skillName = source.path
    .split('/')
    .filter(Boolean)
    .slice(-2, -1)[0] ?? '';
```

On Windows, `source.path` may use `\` separators, causing the split to produce a single-element array and return an empty string.

**Impact**: Skill classification breaks on Windows (e.g. `owner` falls through to default-deny `unknown`).

**Suggested fix**: Use `path.basename(path.dirname(source.path))` from `node:path` instead of manual string splitting.

---

### Issue 5: `computeDirHash` loads entire directory into memory (Performance) 🟡

**Location**: `packages/wrapper/src/sync/skill-transform.ts:132-145`

**Description**:
```ts
async function computeDirHash(dirPath: string): Promise<string> {
  const entries = await readdir(dirPath, { recursive: true });
  let combined = '';
  for (const entry of entries.sort()) {
    const fullPath = join(dirPath, entry.toString());
    try {
      const content = await readFile(fullPath, 'utf8');
      combined += content;
    } catch { /* skip non-files */ }
  }
  return computeHash(combined);
}
```

All file contents are concatenated into a single in-memory string before hashing. If a skill directory contains large reference files (e.g. PDFs, images, or large markdown docs), this can cause memory pressure.

**Impact**: Potential `RangeError: Invalid string length` or excessive memory usage for large skill bundles.

**Suggested fix**: Use a streaming hash (e.g. Node.js `crypto.createHash('sha256')` with `createReadStream`, or hash each file individually and then hash the sorted list of file hashes).

---

## Priority Summary

| # | Issue | Severity | Effort | Blocker for merge? |
|---|-------|----------|--------|-------------------|
| 1 | OpenSpec duplicate detection gap | Medium | Medium | No (spec vs impl mismatch; decide which to change) |
| 2 | Fragile message parsing for cleanup | Medium | Low | No |
| 3 | Hand-rolled YAML parser | Low | Low | No |
| 4 | Unix path assumption | Low | Trivial | No |
| 5 | Dir hash memory pressure | Low | Medium | No |
