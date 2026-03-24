# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**SkillInterop Registry Hub (intended target - not yet implemented in code):**
- Service: GitHub-hosted JSON-LD catalogs published by the `skillinterop` GitHub organization
- Hub catalog URL: `https://raw.githubusercontent.com/skillinterop/registry-hub/main/registry-catalog.jsonld`
- Format: JSON-LD `DataCatalog` (schema.org vocabulary + `skillinterop:` namespace extensions)
- Auth: None (public GitHub raw URLs)
- Status: Documented in `README.md` and `docs/registry-resolver.md` as the intended resolution target; current code does NOT implement this flow yet

**Leaf Registries (intended target - not yet implemented in code):**

| Registry Type | Leaf Catalog URL |
|---------------|-----------------|
| `skill` | `https://raw.githubusercontent.com/skillinterop/skill-registry/main/index.jsonld` |
| `cao-profile` | `https://raw.githubusercontent.com/skillinterop/cao-profile-registry/main/index.jsonld` |
| `reprogate` | `https://raw.githubusercontent.com/skillinterop/reprogate-registry/main/index.jsonld` |

**Arbitrary URLs (current implementation):**
- The `wrapper download <url>` command uses the global `fetch` API to retrieve any URL
- No fixed upstream; URL is passed as a CLI argument at runtime
- No authentication mechanism
- Implementation: `src/commands/download.ts`

## Data Storage

**Databases:**
- None

**File Storage:**
- Local filesystem only
- Downloaded files saved to `.wrapper/downloads/<filename>` (relative to cwd)
- Lock file written to `wrapper.lock` (relative to cwd)
- Implementation: `src/registry/lockfile.ts`, `src/commands/download.ts`

**Lock File (`wrapper.lock`):**
- Format: JSON
- Schema defined in `src/registry/types.ts`
- Fields: `lockVersion` (string), `items` (array of `LockedItem`)
- Each `LockedItem`: `url`, `localPath`, `downloadedAt` (ISO 8601 timestamp)
- Proposed future schema shown in `docs/lockfile-example.json` adds: `identifier`, `registryType`, `catalogUrl`, `contentUrl`, `channel`, `status`, `lockedAt`

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None - no authentication anywhere in current implementation
- All target URLs are public GitHub raw content endpoints

## Monitoring & Observability

**Error Tracking:**
- None - errors are logged to `console.error` and `process.exit(1)` is called on failure

**Logs:**
- `console.log` for progress messages (download start, save path, lockfile update)
- `console.error` for errors
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- Not detected - no deployment configuration present

**CI Pipeline:**
- Not detected - no `.github/workflows/`, `.circleci/`, or similar CI config present

## Environment Configuration

**Required env vars:**
- None - current implementation requires no environment variables

**Secrets location:**
- Not applicable - no secrets in current implementation

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None - the tool only makes outbound HTTP GET requests via `fetch`; no webhook delivery

## Network Access Pattern

The current code makes a single outbound HTTP GET per `download` command invocation:

```
CLI invocation
  → fetch(url)          # arbitrary URL via Node global fetch
  → write to disk       # .wrapper/downloads/<filename>
  → update wrapper.lock
```

The intended (not yet implemented) registry resolution flow would make multiple sequential GETs:

```
fetch registry-catalog.jsonld (hub)
  → for each hasPart[].url: fetch index.jsonld (leaf)
    → for each dataset[].url: fetch content document (skill/profile/gate)
```

All network calls target public GitHub raw content (`raw.githubusercontent.com`) with no auth headers.

---

*Integration audit: 2026-03-24*
