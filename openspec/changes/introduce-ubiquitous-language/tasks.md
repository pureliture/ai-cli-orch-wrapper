## 1. Vocabulary source of truth

- [x] 1.1 Create `docs/reference/ubiquitous-language.md` with core terms, discouraged synonyms, naming rules, and examples.
- [x] 1.2 Scope the first slice to provider execution and run/session artifacts.
- [x] 1.3 Add backlog placeholders for context sync, harness surfaces, consent/permissions, and verification without trying to fully define them in this workflow.
- [x] 1.4 Add a review checklist for future OpenSpec changes and PRs.

## 2. Documentation integration

- [x] 2.1 Link the vocabulary from `README.md`, `docs/README.md`, and `docs/architecture.md`.
- [x] 2.2 Update `docs/security.md` and `docs/reference/session-artifacts.md` only where terminology clarification improves safety.
- [x] 2.3 Keep doc edits scoped; avoid broad prose rewrites unrelated to vocabulary.

## 3. Automated terminology guard

- [x] 3.1 Add a small focused automated terminology check for high-risk discouraged synonyms in the initial documentation surface.
- [x] 3.2 Include tests or fixtures that cover allowed terms, discouraged terms, accepted aliases, and allowlisted legacy language.
- [x] 3.3 Document how to update the check without turning it into broad prose policing.

## 4. Code naming guardrails

- [x] 4.1 Avoid a strict code rename campaign.
- [x] 4.2 Only adjust implementation names when ambiguity affects behavior, emitted artifacts, or tests.
- [x] 4.3 Prefer aliases or docs-only alignment when a legacy name is stable and not misleading at runtime.

## 5. Verification

- [x] 5.1 Run `openspec validate introduce-ubiquitous-language --type change --strict`.
- [x] 5.2 Run formatter/checks for touched Markdown files.
- [x] 5.3 Run the terminology guard and its focused tests.
- [x] 5.4 Reader-test the glossary with a fresh agent or sub-agent and record any confusing terms.

Reader-test note: completed with sub-agent `Newton` on 2026-05-14. The reader could explain `run`, `session`, `brief`, `output.log`, `provider`, and `provider advisory output`. Non-blocking drift candidates were addressed by aligning the canonical `provider advisory output` term, renaming the README table label from `Provider run` to `Provider invocation`, clarifying run/session brief examples, and narrowing the spec scenario to first-slice terms plus backlog placeholders.
