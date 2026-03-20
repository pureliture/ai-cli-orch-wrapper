# ai-cli-orch-wrapper

AI CLI Orchestration Wrapper — consumes registry-hub and leaf registries.

## Overview

This wrapper CLI provides commands to interact with the skillinterop registry ecosystem:

- **sync** — Fetch and cache registry manifests
- **search** — Search for skills, profiles, and gates
- **install** — Install items and track in lock file
- **lock** — Manage reproducible lock file

## Installation

```bash
npm install
npm run build
```

## Quick Start

```bash
# Add the registry hub
wrapper registry add github:skillinterop/registry-hub

# Search for items
wrapper registry search router

# Install a skill
wrapper registry install skill/org/workmux-router

# View lock file
wrapper registry lock --show
```

## Commands

### `wrapper registry sync`

Fetch hub-config and all leaf manifests, cache locally.

```bash
wrapper registry sync [--hub <url>]
```

### `wrapper registry search <query>`

Search across all registries.

```bash
wrapper registry search <query> [options]

Options:
  --type <type>       Filter by type (skill, cao-profile, reprogate)
  --channel <channel> Filter by channel (stable, experimental)
  --refresh           Force refresh from remote
```

### `wrapper registry install <id|name>`

Install an item by canonical ID or name.

```bash
wrapper registry install <id|name> [options]

Options:
  --dry-run    Preview without installing
  --force      Install even if deprecated
```

### `wrapper registry lock`

Manage the lock file.

```bash
wrapper registry lock [options]

Options:
  --show       Display current lock file
  --generate   Regenerate lock file
```

## Architecture

```
registry-hub (aggregator)
    │
    ├── skill-registry (leaf)
    ├── cao-profile-registry (leaf)
    └── reprogate-registry (leaf)
           │
           ▼
    ai-cli-orch-wrapper (consumer)
```

The wrapper:
1. Fetches `hub-config.json` from registry-hub
2. Resolves each leaf registry's `manifest.json`
3. Aggregates and caches items locally
4. Provides search/install with lock file tracking

## Lock File

The `wrapper.lock` file ensures reproducible installations:

```json
{
  "lockVersion": "1.0.0",
  "hubSource": "https://github.com/skillinterop/registry-hub",
  "items": [
    {
      "canonicalId": "skill/org/[MASKED_EMAIL]",
      "sourceRef": "aed97ff..."
    }
  ]
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run CLI
node dist/cli.js registry sync
```

## Related Repos

- [`registry-hub`](https://github.com/skillinterop/registry-hub) — Top-level aggregator
- [`skill-registry`](https://github.com/skillinterop/skill-registry) — Skill packages
- [`cao-profile-registry`](https://github.com/skillinterop/cao-profile-registry) — CAO profiles
- [`reprogate-registry`](https://github.com/skillinterop/reprogate-registry) — ReproGate packages

## License

MIT
