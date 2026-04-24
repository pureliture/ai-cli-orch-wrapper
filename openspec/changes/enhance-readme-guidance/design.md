## Context

Latest `origin/main` has already changed the README from the earlier baseline. The current top-level flow is:

- 현재 구현 범위
- 설치
- Provider 설정
- CLI 개요
- 이 저장소가 다루는 범위
- Architecture at a Glance
- Harness Layout
- 저장소 구조
- 개발
- 문제 해결
- 문서

The README now introduces the harness as more than a raw wrapper and links evaluators to the case study, roadmap, and PR implementation plan. Provider setup also clarifies that `--version` fallback checks binary availability rather than remote authentication. Validation found that the currently published npm CLI can lag behind the source implementation, so README wording must distinguish public release commands from source-build commands where needed.

The remaining design problem is not topic discovery. It is presentation and operational completeness inside the existing outline: users need a clearer first-use sequence, command purpose mapping, architecture orientation, generated/source surface distinction, durable troubleshooting, and rendered Markdown quality.

## Goals / Non-Goals

**Goals:**
- Preserve the current top-level README outline from latest `origin/main`.
- Strengthen existing sections rather than adding broad new sections.
- Make install, provider setup, source-build sync checks, command usage, and troubleshooting readable as a practical path.
- Improve rendered scanability using concise tables, fenced examples, and one compact architecture diagram.
- Reflect the current README's new evaluator-facing docs links and planned-work framing.
- Make the README explicit that this repository uses OpenSpec proposal/design/spec/task artifacts as the default change workflow.
- Add a durable commit message template and Korean commit prompt that Codex can follow when creating commits.
- Keep README as a gateway to deeper docs, not a replacement for them.

**Non-Goals:**
- Add dedicated top-level sections for OpenSpec workflow, provider model, or ccg-workflow compatibility.
- Remove or rewrite the new `현재 구현 범위` framing from latest `origin/main`.
- Change runtime behavior, CLI behavior, package exports, dependencies, or generated harness outputs.
- Inline full architecture, runbook, roadmap, or PR plan contents into the README.
- Add marketing-heavy or stale-prone elements such as sponsor blocks, contributor grids, star history, or hardcoded test-count badges.

## Decisions

### Decision: Treat latest `origin/main` README as the source baseline

The implementation will not revert to the earlier README outline. It will preserve the current headings and improve their contents.

Alternative considered: reuse the earlier OpenSpec proposal unchanged.
Why not chosen: `origin/main` has added a current implementation scope section and evaluator documentation links that should be treated as intentional baseline content.

### Decision: Keep improvements within existing top-level sections

The README will not add broad conceptual headings for provider model, OpenSpec workflow, or ccg-workflow compatibility.

Alternative considered: add new sections for each concept.
Why not chosen: the user explicitly wants only clearly necessary headings added, and the current outline can absorb the needed guidance.

### Decision: Use rendered scan aids selectively

Tables should be used for command grouping, provider requirements, and documentation navigation when they improve scanability. Fenced command blocks should remain copyable and avoid inline commentary inside commands.

Alternative considered: keep all command information as plain shell blocks.
Why not chosen: command-only blocks do not explain purpose, sequencing, or when a command is appropriate.

### Decision: Add one architecture diagram, not a full architecture reference

The existing `Architecture at a Glance` section should include a compact diagram showing `.claude` source assets, `aco sync`, generated Codex/Gemini surfaces, provider execution, and session operations.

Alternative considered: move all architecture explanation into README.
Why not chosen: detailed architecture already belongs in `docs/architecture.md`; README should orient and link.

### Decision: Distinguish public npm release behavior from source implementation

The README should not imply that every source command is available in the currently published npm package. Commands such as `sync` can be documented as source implementation behavior and shown through the local checkout build path when public release validation does not expose them.

Alternative considered: keep documenting `npx @pureliture/ai-cli-orch-wrapper sync --check`.
Why not chosen: validation showed the current public package reports `aco: unknown command 'sync'`, so the README must avoid presenting that command as a guaranteed npx path.

### Decision: Troubleshooting should cover durable setup failures

Troubleshooting should include stable failure modes that are likely to remain relevant: missing `aco`, missing provider CLI or auth, stale slash commands, and sync drift.

Alternative considered: document every known issue.
Why not chosen: README should avoid becoming a full runbook and should link to deeper docs for operational detail.

### Decision: Add both a Git commit template and an AI prompt

The repository will include `.gitmessage` as the concrete Git template and `docs/guides/commit-message-prompt.md` as the AI-facing Korean prompt. `CLAUDE.md` and `AGENTS.md` will reference both so Claude and Codex inherit the same commit-writing rule surface.

Alternative considered: document commit style only in README.
Why not chosen: README guidance is not strong enough to steer Codex during commit creation, and Git itself needs a template file that users can configure with `git config commit.template .gitmessage`.

## Risks / Trade-offs

- [README becomes too long] → Keep details concise and link to deeper docs for full references.
- [Rendered tables become maintenance burden] → Use small tables with stable command groups and avoid exhaustive option matrices.
- [Architecture diagram drifts] → Keep diagram conceptual and point detailed behavior to `docs/architecture.md`.
- [New top-level section creep] → Require a concrete unresolved gap before adding any new top-level heading.
- [Troubleshooting duplicates runbook] → Cover durable first-response steps only and link to `docs/guides/runbook.md`.
- [README overclaims public npm behavior] → Separate source implementation commands from public release commands when validation shows package lag.
- [Source build can fail before sync validation] → Add a narrow local module declaration when dependency types are unavailable to the compiler in the current workspace, and allow source-owned `src/types/**/*.d.ts` declarations through `.gitignore`.
- [AI contributor trailers may not map to GitHub accounts] → Require `Co-authored-by` when a GitHub-recognized identity exists and always include explicit `AI-CLI` and `AI-Model` trailers as a fallback record.

## Migration Plan

1. Update README content inside the current top-level heading structure from latest `origin/main`.
2. Improve the first-use path and CLI overview with rendered scan aids.
3. Add one compact architecture diagram in `Architecture at a Glance`.
4. Expand troubleshooting and documentation navigation without duplicating deep docs.
5. Add commit template and AI commit prompt, then reference them from README and repo instruction surfaces.
6. Fix narrow validation blockers that prevent source-build sync verification.
7. Review rendered Markdown quality as part of implementation.

Rollback is clean: revert the README edit and this OpenSpec change directory.

## Open Questions

- Whether prerequisites should be a short paragraph or a small table under `설치`.
- Whether `aco sync --check` should appear in both install flow and troubleshooting, with different framing.
