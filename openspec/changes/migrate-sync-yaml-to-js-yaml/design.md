## Context

The sync layer parses and emits YAML-like data in three places:

- agent frontmatter parsing in `agent-parse.ts`
- formatter configuration parsing in `formatter.ts`
- Gemini agent frontmatter serialization in `agent-gemini-transform.ts`

The current approach uses narrow custom parsing and string construction. That works for simple scalar fields but is brittle for YAML that project configuration naturally uses: quoted strings containing colons, arrays with quoted values, anchors and aliases, nested formatter maps, multiline descriptions, and escaped characters.

Issue #57 comes from PR #55 review feedback and asks to replace those hand-rolled YAML paths with `js-yaml`.

## Goals / Non-Goals

**Goals:**

- Use a maintained YAML implementation for sync-layer parsing and serialization.
- Preserve the existing `AgentSpec`, `FormatterConfig`, and `GeminiAgent` public shapes.
- Add regression coverage for valid YAML that custom parsing cannot handle reliably.
- Keep generated Gemini frontmatter syntactically valid YAML.
- Keep sync behavior backward compatible for current simple fixtures.

**Non-Goals:**

- Do not change the canonical `.claude/agents/*.md` or `.aco/formatter.yaml` schema.
- Do not add schema validation beyond the existing typed normalization.
- Do not migrate Go-side `aco delegate` parsing in this change.
- Do not introduce broad YAML formatting churn outside generated Gemini agent frontmatter.

## Decisions

1. **Use `js-yaml.load` at YAML input boundaries**

   `agent-parse.ts` and `formatter.ts` should call `js-yaml.load` on frontmatter or formatter content, then normalize the result into existing TypeScript interfaces. The parser should reject or ignore non-object roots according to the current fallback behavior.

   Alternative considered: extend the custom parser with more YAML cases. That continues to reimplement YAML partially and leaves future edge cases unresolved.

2. **Use `js-yaml.dump` for Gemini frontmatter output**

   `serializeGeminiAgent` should build a plain metadata object and dump it as YAML frontmatter. This avoids manual escaping for colons, quotes, multiline descriptions, and other YAML-sensitive content.

   Alternative considered: keep manual serialization with targeted escaping. That is still a partial YAML emitter and duplicates library behavior.

3. **Declare runtime dependency if sync code imports `js-yaml` at runtime**

   Because the wrapper package publishes compiled sync/runtime code, `js-yaml` must be in `dependencies` if imported by runtime modules. Type declarations may be in `devDependencies`.

   Alternative considered: add `js-yaml` only as a devDependency as stated in the issue checklist. That would work in the repository but can fail for installed package consumers if runtime code requires the module.

4. **Keep type normalization explicit after parsing**

   YAML parsing returns unknown data. The implementation should keep explicit `String(...)`, `Number(...)`, array normalization, and object guards where the current interfaces require strings, numbers, or arrays.

   Alternative considered: cast parsed YAML directly to internal types. That hides malformed config risk and weakens TypeScript guarantees.

## Risks / Trade-offs

- **Dependency surface increases** -> Use the mature `js-yaml` package and keep dependency placement explicit.
- **Generated YAML formatting may change** -> Constrain assertions to semantic fields and valid frontmatter, not exact whitespace, unless exact output is contractually required.
- **YAML anchors and aliases can produce shared object references** -> Normalize parsed structures into plain config values before use.
- **Invalid YAML errors may differ from current fallback behavior** -> Preserve current error/reporting behavior where callers already expect failures, and add tests around parse errors if needed.

## Migration Plan

1. Add `js-yaml` and type declarations to package metadata with correct runtime/dev classification.
2. Replace input parsing in `agent-parse.ts` and `formatter.ts`.
3. Replace Gemini frontmatter serialization with `js-yaml.dump`.
4. Add tests for quoted strings, colon-containing strings, anchors/aliases, nested formatter config, and generated frontmatter validity.
5. Run wrapper tests and typecheck.

## Open Questions

None.
