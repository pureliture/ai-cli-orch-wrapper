## 1. Dependency Setup

- [x] 1.1 Add `js-yaml` to `packages/wrapper` runtime dependencies if sync code imports it at runtime.
- [x] 1.2 Add TypeScript declarations for `js-yaml` to dev dependencies if required by typecheck.
- [x] 1.3 Update the package lockfile consistently with the dependency changes.

## 2. Agent Frontmatter Parsing

- [x] 2.1 Add tests for quoted descriptions containing colons, quoted inline arrays, anchors/aliases, and multiline scalar fields in agent frontmatter.
- [x] 2.2 Replace `agent-parse.ts` custom YAML parsing with `js-yaml.load`.
- [x] 2.3 Keep explicit normalization from parsed YAML values into `AgentSpec` string, number, and array fields.
- [x] 2.4 Preserve behavior for frontmatter-free agent files.

## 3. Formatter Parsing

- [x] 3.1 Add tests for nested formatter config containing model alias maps, provider defaults, anchors/aliases, and YAML-sensitive string values.
- [x] 3.2 Replace `formatter.ts` custom YAML parsing with `js-yaml.load`.
- [x] 3.3 Keep formatter model resolution behavior unchanged for existing simple config fixtures.
- [x] 3.4 Preserve error behavior for missing, invalid, or unsupported formatter config.

## 4. Gemini Agent Serialization

- [x] 4.1 Add tests that generated Gemini frontmatter remains valid YAML when descriptions contain colons, quotes, or multiline content.
- [x] 4.2 Replace manual Gemini frontmatter string construction with `js-yaml.dump`.
- [x] 4.3 Ensure absent optional Gemini fields are omitted from generated frontmatter.
- [x] 4.4 Ensure generated Markdown body placement remains unchanged after the frontmatter block.

## 5. Verification

- [x] 5.1 Run `npm --workspace packages/wrapper test`.
- [x] 5.2 Run `npm --workspace packages/wrapper run typecheck`.
- [x] 5.3 Inspect generated Gemini agent output for stable, valid YAML frontmatter.
