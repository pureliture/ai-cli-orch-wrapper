## Context

The repo already has strong architectural boundaries, but the language boundary is implicit. This is risky for AI-assisted development because agents and LLM-assisted documentation depend on names to infer intent. If `run`, `session`, `artifact`, and `brief` are used inconsistently, future changes can look correct locally while weakening the overall design.

This workflow should make the vocabulary explicit without turning it into a heavy taxonomy project. The first implementation slice should stay narrow: provider invocation and session artifacts first, then context sync and harness/generated boundaries later.

## Goals / Non-Goals

**Goals:**

- Define a compact glossary of terms that are already central to provider invocation and session artifacts.
- Classify terms by domain area: provider execution, artifacts, context sync, harness surfaces, permissions, and verification.
- Provide naming rules that future code, docs, tests, and OpenSpec changes can follow.
- Add an automated terminology check from the first slice, with aliases or allowlists for intentional legacy language.
- Add reader-facing links so contributors can discover the vocabulary before implementing changes.

**Non-Goals:**

- Exhaustively document every function, test helper, or file.
- Rename stable public commands unless there is a correctness issue.
- Add a custom parser, strict rename campaign, or large lint framework in the first slice.

## Decisions

1. **Create a Markdown reference first**
   - Option A: Add code-level linting first.
   - Option B: Add `docs/reference/ubiquitous-language.md` first, with a focused automated terminology check in the same slice.
   - Decision: choose B. The repo needs a shared human and AI reference, but the first slice should still include an automated drift guard.

2. **Use domain sections instead of alphabetic-only glossary**
   - Option A: Alphabetical terms only.
   - Option B: Domain sections plus an alphabetical index.
   - Decision: choose B. Gray box reasoning depends on understanding relationships, not just definitions.

3. **Separate preferred terms from rejected synonyms**
   - Option A: Only define accepted terms.
   - Option B: Also list discouraged terms such as `raw provider truth` or `generated source`. <!-- terminology-check allow: raw provider truth --><!-- terminology-check allow: generated source -->
   - Decision: choose B. Rejected synonyms prevent subtle design drift.

4. **Automate narrowly from the start**
   - Option A: Add broad linting over all Markdown and TypeScript immediately.
   - Option B: Add a small script or test for high-risk discouraged terms in the initial documentation surface.
   - Decision: choose B. Do add automation from the first slice, but avoid brittle text policing across the whole repo.

5. **Keep code renames soft**
   - Option A: Treat every preferred term mismatch as a required code rename.
   - Option B: Prefer docs-only alignment, aliases, and targeted naming where ambiguity affects behavior or artifacts.
   - Decision: choose B. The ubiquitous language should clarify the gray box, not create churn or break public contracts.

## Proposed Document Shape

```text
docs/reference/ubiquitous-language.md
├── Purpose
├── Domain Model
├── Core Terms
│   ├── Provider execution
│   ├── Run/session artifacts
│   ├── Context sync (backlog placeholders)
│   ├── Harness and generated surfaces (backlog placeholders)
│   ├── Permission and consent
│   └── Verification
├── Discouraged Synonyms
├── Naming Rules
├── Examples
└── Review Checklist
```

## Risks / Trade-offs

- [Risk] Glossary becomes stale. [Mitigation] Add a focused terminology check from the first slice and link it from OpenSpec workflow docs.
- [Risk] Overzealous renaming causes churn. [Mitigation] Limit initial changes to docs, aliases, and targeted naming only when ambiguity affects behavior or artifacts.
- [Risk] The glossary is too abstract for new contributors. [Mitigation] Include concrete examples from `aco ask`, `aco run`, `aco sync`, and `aco doctor`.

## Validation Strategy

- Run `openspec validate introduce-ubiquitous-language --type change --strict`.
- Run Markdown formatting checks for touched docs.
- Include a focused terminology check with allowed, discouraged, alias, and allowlist examples.
- Reader-test the glossary by asking whether a fresh agent can explain the difference between `run`, `session`, `brief`, and `output.log`.

## Open Questions

- Which exact file set should the first terminology check cover: glossary only, touched docs, or a small allowlisted docs subset?
- Should artifact field names be considered part of the ubiquitous language contract in the first slice, or deferred until structured findings artifacts land?
- Should the glossary live only under `docs/reference/`, or should a shorter generated excerpt be included in `AGENTS.md`/`GEMINI.md` through `aco sync` later?
