# SkillInterop Latest Registry Structure

This document captures the **latest live public structure** exposed by the `skillinterop` organization as of **2026-03-23**.

## Important Note

The live repository trees and the upstream READMEs are not perfectly aligned right now.

- some upstream READMEs still describe `hub-config.json` / `manifest.json`
- the actual public repo roots now expose:
  - `registry-hub/registry-catalog.jsonld`
  - `<leaf-registry>/index.jsonld`

For wrapper-consumer work, the live file structure should be treated as the source of truth.

## Live Topology

```text
skillinterop/
├── registry-hub/
│   ├── registry-catalog.jsonld
│   ├── schemas/
│   ├── docs/
│   └── sources/
├── skill-registry/
│   ├── index.jsonld
│   ├── schemas/
│   └── skills/
└── reprogate-registry/
    ├── index.jsonld
    ├── schemas/
    └── gates/
```

## Hub Catalog

The hub currently publishes a JSON-LD `DataCatalog` in `registry-catalog.jsonld`:

```json
{
  "@type": "DataCatalog",
  "name": "SkillInterop Registry Hub",
  "description": "Central entrypoint for SkillInterop registries",
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

### Current leaf links in the hub

| Registry Type | Leaf catalog URL |
|---------------|------------------|
| `skill` | `https://raw.githubusercontent.com/skillinterop/skill-registry/main/index.jsonld` |
| `reprogate` | `https://raw.githubusercontent.com/skillinterop/reprogate-registry/main/index.jsonld` |

## Leaf Catalogs

Each leaf registry publishes a root `index.jsonld` document. The shape is consistently a `DataCatalog` with a `dataset` array.

### Skill registry

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

### ReproGate registry

```json
{
  "@type": "DataCatalog",
  "name": "ReproGate Registry",
  "dataset": [
    {
      "@type": "SoftwareApplication",
      "identifier": "reprogate/org/code-review-gate@0.1.0",
      "url": "./gates/code-review-gate/GATE.md",
      "skillinterop:status": "active",
      "skillinterop:channel": "experimental"
    }
  ]
}
```

## Consumer Resolution Flow

For this wrapper, the latest intended resolution flow is:

```text
1. Fetch registry-hub/registry-catalog.jsonld
2. Read hasPart[] entries
3. Fetch each leaf index.jsonld
4. Normalize dataset[] items into a unified in-memory index
5. Resolve relative item URLs against the raw GitHub base of the source repo
6. Apply registryType / channel / status filters
7. Expose search / install / lock workflows from the normalized index
```

## Normalization Notes

- `hasPart[].url` is already an absolute raw GitHub URL
- leaf `dataset[].url` is relative and must be resolved against the source repository root
- `identifier` already includes type, namespace, name, and version
- `skillinterop:status` and `skillinterop:channel` are part of the effective resolution metadata

## Implications For This Repo

The current implementation in this repository is not yet caught up with the live upstream structure.

What remains to align:

- fetch and parse `registry-catalog.jsonld`
- fetch and parse leaf `index.jsonld`
- resolve relative content document URLs
- rebuild the local lock-file shape around upstream identifiers instead of downloader-only fields
- add search / install / sync flows over the normalized catalog
