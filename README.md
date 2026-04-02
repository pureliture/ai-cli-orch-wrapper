# ai-cli-orch-wrapper

SkillInterop wrapper foundation for consuming the latest registry-hub / leaf-registry structure.

## Overview

As of **2026-03-23**, the public `skillinterop` organization exposes a JSON-LD based registry layout:

- `registry-hub` publishes `registry-catalog.jsonld`
- each leaf registry publishes `index.jsonld`
- the hub links to leaves through `hasPart`
- each leaf exposes installable/searchable entries through `dataset`

This repository is the consumer-side wrapper intended to resolve those catalogs.

## Latest Upstream Structure

```text
skillinterop/
  registry-hub/
    registry-catalog.jsonld
  skill-registry/
    index.jsonld
    skills/<skill-name>/SKILL.md
  reprogate-registry/
    index.jsonld
    gates/<gate-name>/GATE.md
```

### Hub catalog shape

The hub is a `DataCatalog` that points to leaf registries:

```json
{
  "@type": "DataCatalog",
  "name": "SkillInterop Registry Hub",
  "hasPart": [
    {
      "@type": "DataCatalog",
      "name": "Skill Registry",
      "url": "https://raw.githubusercontent.com/skillinterop/skill-registry/main/index.jsonld",
      "skillinterop:registryType": "skill"
    }
  ]
}
```

### Leaf catalog shape

Each leaf also uses `DataCatalog`, with items exposed through `dataset`:

```json
{
  "@type": "DataCatalog",
  "name": "Skill Registry",
  "dataset": [
    {
      "@type": "SoftwareSourceCode",
      "identifier": "skill/org/workmux-router@1.0.0",
      "name": "workmux-router",
      "version": "1.0.0",
      "url": "./skills/workmux-router/SKILL.md",
      "skillinterop:status": "active",
      "skillinterop:channel": "stable"
    }
  ]
}
```

## Installation

```bash
npm install
npm run build
```

## Quick Start

```bash
npm install
npm run build
aco help
aco version
```

## Refreshing a Pre-`aco` Global Link

If this machine was linked or installed before the command-surface cutover, it can still have a stale package-owned `wrapper` executable in the global npm bin directory even though the package now exposes only `aco`.

Use this one refresh path to remove only the stale package-owned shim and then relink the current package:

```bash
npm run cleanup:legacy-bin
npm link
```

After the relink, `aco help` should work from the global install state and any unrelated `wrapper` executable should be left untouched.

## Intended Resolution Flow

1. fetch `registry-hub/registry-catalog.jsonld`
2. read each `hasPart[].url`
3. fetch each leaf `index.jsonld`
4. aggregate leaf `dataset[]` entries by identifier / registry type / channel / status
5. resolve relative `url` fields to actual content documents in the source repo
6. drive search / install / lock workflows from the aggregated catalog

## Registry Types Currently Published Upstream

| Type | Catalog | Item document root |
|------|---------|--------------------|
| `skill` | `skill-registry/index.jsonld` | `skills/<name>/SKILL.md` |
| `reprogate` | `reprogate-registry/index.jsonld` | `gates/<name>/GATE.md` |

## Current Repository Status

The upstream registry structure has moved ahead of this repo's implementation.

Today this repo still contains a small downloader-oriented CLI prototype:

- `aco download <url>`
- `aco help`
- `aco version`

That prototype is useful as scaffolding, but it does **not** yet implement the full upstream JSON-LD registry resolution flow described above.

## Lock File

`docs/lockfile-example.json` shows a **proposed consumer lockfile** for the latest upstream registry layout:

```json
{
  "lockVersion": "1.0.0",
  "catalogSource": "https://raw.githubusercontent.com/skillinterop/registry-hub/main/registry-catalog.jsonld",
  "items": [
    {
      "identifier": "skill/org/workmux-router@1.0.0",
      "registryType": "skill",
      "catalogUrl": "https://raw.githubusercontent.com/skillinterop/skill-registry/main/index.jsonld",
      "contentUrl": "https://raw.githubusercontent.com/skillinterop/skill-registry/main/skills/workmux-router/SKILL.md",
      "channel": "stable",
      "status": "active",
      "lockedAt": "2026-03-23T05:34:44Z"
    }
  ]
}
```

## Project Layout

```text
src/
  cli.ts
  commands/download.ts
  registry/lockfile.ts
  registry/types.ts
docs/
  registry-resolver.md   latest SkillInterop JSON-LD structure notes
  lockfile-example.json  proposed consumer lock example
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the current prototype CLI
aco help

# Verification currently available in this repo
npm test
npm run lint
```

## Known Limitations

- the code in this repo is not yet aligned with the latest upstream JSON-LD catalogs
- search / install / sync against `registry-catalog.jsonld` and leaf `index.jsonld` are not implemented yet
- the current lock-file helpers still reflect downloader-era scaffolding, not the proposed registry-consumer shape
- some upstream READMEs still mention earlier `hub-config.json` / `manifest.json` terminology, but the live repo trees now expose `registry-catalog.jsonld` and `index.jsonld`

## License

MIT
