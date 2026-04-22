## Why

The sync layer currently relies on hand-rolled YAML parsing and frontmatter serialization for agent definitions, formatter config, and Gemini agent output. That approach is fragile for real YAML input such as quoted scalars, colons in strings, anchors, aliases, nested mappings, and multiline values.

This change replaces custom YAML parsing/serialization with `js-yaml` so `aco sync` handles project configuration using a maintained YAML implementation.

## What Changes

- Introduce `js-yaml` for YAML parsing and serialization used by the sync layer.
- Replace `agent-parse.ts` hand-rolled frontmatter parsing with `js-yaml.load`.
- Replace `formatter.ts` hand-rolled formatter parsing with `js-yaml.load`.
- Replace manual Gemini agent frontmatter serialization with `js-yaml.dump`.
- Add coverage for YAML edge cases including quoted strings, colons, anchors/aliases, nested formatter config, and generated Gemini frontmatter.
- Keep public sync behavior compatible except that previously unsupported valid YAML forms become accepted.

## Capabilities

### New Capabilities
- `context-sync-yaml-processing`: Covers robust YAML parsing and serialization for sync-layer agent, formatter, and generated Gemini agent configuration.

### Modified Capabilities

None.

## Impact

- Affected code: `packages/wrapper/src/sync/agent-parse.ts`, `packages/wrapper/src/sync/formatter.ts`, `packages/wrapper/src/sync/agent-gemini-transform.ts`, and sync tests.
- Affected package metadata: `packages/wrapper/package.json` and lockfile dependency entries for `js-yaml` and its TypeScript types if needed.
- Affected behavior: valid YAML syntax that the hand-rolled parser could not represent will parse and serialize correctly.
