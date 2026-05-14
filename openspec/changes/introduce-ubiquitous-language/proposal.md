## Why

`ai-cli-orch-wrapper` has grown a dense domain language: `run`, `session`, `provider`, `advisory`, `brief`, `artifact`, `harness`, `source surface`, `generated target`, `sync manifest`, `permission profile`, and more.

Those terms are currently scattered across README, architecture docs, security docs, tests, and implementation names. Human maintainers can infer the model, but AI agents and LLM-assisted docs must rediscover it every time unless the repo owns the vocabulary explicitly. That weakens the gray box boundary because the interface is not only code; it is also the language used to plan, review, and verify changes.

## What Changes

- Add a repo-owned ubiquitous language reference for `aco` domain terms, starting narrowly with provider invocation and session artifacts.
- Define required and discouraged terms for the first slice, then leave context sync and harness/generated boundaries as explicit backlog areas.
- Add an automated terminology check in the first slice so new docs and code do not drift into conflicting terminology.
- Link the vocabulary from README, architecture, security, and workflow docs where it helps readers.

## Capabilities

### New Capabilities

- `ubiquitous-language`: Maintainers and agents can use one domain vocabulary across docs, specs, code, tests, and provider prompts.

### Modified Capabilities

- Documentation and workflow guidance should reference the vocabulary when explaining `aco ask`, `aco run`, `aco sync`, and artifact behavior.

## Impact

- `docs/reference/ubiquitous-language.md`: new source-of-truth glossary and naming rules, initially scoped to provider invocation and session artifacts.
- `docs/architecture.md`, `docs/security.md`, `docs/reference/session-artifacts.md`, `README.md`: add links or short references where terminology is introduced.
- `packages/wrapper/src/**`: avoid a strict rename campaign; only use targeted naming, aliases, or docs-only alignment where they reduce ambiguity without breaking public API.
- `packages/wrapper/tests/**`: add terminology-sensitive tests only where runtime behavior relies on names in emitted artifacts.
- Terminology check script or test: add a focused automated guard for high-risk discouraged terms in the initial documentation surface.
- OpenSpec docs: future changes should use the vocabulary in capability names and scenarios.

## Non-Goals

- Do not rename the public `aco` CLI.
- Do not perform broad code renames for style only.
- Do not rewrite all docs in one pass.
- Do not make the glossary a marketing page; it is an operator and implementer reference.
