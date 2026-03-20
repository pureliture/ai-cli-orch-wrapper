# Registry Resolver Design

This document describes the registry resolver architecture and resolution flow.

## Overview

The wrapper consumes registries through a two-level resolution:

1. **Hub Resolution** — Fetch `hub-config.json` from `registry-hub`
2. **Leaf Resolution** — For each source in hub-config, fetch the leaf `manifest.json`

## Resolution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        wrapper CLI                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Fetch hub-config.json from registry-hub                    │
│     GET https://raw.githubusercontent.com/skillinterop/        │
│         registry-hub/main/hub-config.json                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Parse sources array                                         │
│     [skill-registry, cao-profile-registry, reprogate-registry] │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 3a. Fetch       │ │ 3b. Fetch       │ │ 3c. Fetch       │
│ skill-registry  │ │ cao-profile-reg │ │ reprogate-reg   │
│ manifest.json   │ │ manifest.json   │ │ manifest.json   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Aggregate items into unified index                          │
│     - Apply channel filters (stable-only or all)               │
│     - Record source commit SHAs for locking                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Cache locally in .wrapper/cache/                            │
│     - skill-manifest.json                                       │
│     - cao-profile-manifest.json                                 │
│     - reprogate-manifest.json                                   │
│     - metadata.json (commit SHAs, timestamps)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Commands

### `wrapper registry sync`

Fetches hub-config and all leaf manifests, then caches locally.

```bash
wrapper registry sync
# Syncing from hub: https://github.com/skillinterop/registry-hub
# Found 3 registry sources
#   skill: 1 items (aed97ff)
#   cao-profile: 1 items (729070d)
#   reprogate: 1 items (e20510c)
# Sync complete: 3 total items cached
```

### `wrapper registry search <query>`

Searches across all cached manifests.

```bash
wrapper registry search router
# Found 1 results:
#
#   skill/org/[MASKED_EMAIL]
#     Natural-language task launcher and router using workmux and git worktree
```

### `wrapper registry install <id|name>`

Installs an item and records it in `wrapper.lock`.

```bash
wrapper registry install skill/org/workmux-router
# Installed: skill/org/[MASKED_EMAIL]
#   Version: 1.0.0
#   Locked at: aed97ff
```

### `wrapper registry lock`

Displays or regenerates the lock file.

```bash
wrapper registry lock --show
# Lock Version: 1.0.0
# Installed Items (1):
#   skill/org/[MASKED_EMAIL]
#     source: https://github.com/skillinterop/skill-registry
#     ref: aed97ffabc123...
#     installed: 2026-03-20T07:00:00Z
```

## Lock File Format

The `wrapper.lock` file records exact versions and commit SHAs:

```json
{
  "lockVersion": "1.0.0",
  "generatedAt": "2026-03-20T07:00:00Z",
  "hubSource": "https://github.com/skillinterop/registry-hub",
  "items": [
    {
      "canonicalId": "skill/org/[MASKED_EMAIL]",
      "registryType": "skill",
      "name": "workmux-router",
      "version": "1.0.0",
      "sourceRepo": "https://github.com/skillinterop/skill-registry",
      "sourceRef": "aed97ffabc123...",
      "installedAt": "2026-03-20T07:00:00Z"
    }
  ]
}
```

## Caching Strategy

- Cache is stored in `.wrapper/cache/`
- Each leaf manifest is cached separately
- Metadata includes commit SHAs for staleness detection
- `--refresh` flag forces re-fetch from remote

## Future Enhancements

- [ ] Local path sources (for development)
- [ ] Content integrity hashes
- [ ] Parallel manifest fetching
- [ ] Offline mode with cached manifests
- [ ] Version constraint resolution (`>=1.0.0`, `^1.2.0`)
