# Goal 2 Release Checklist

## Scope checklist

- [x] PR #92 formatting/lint regression fixed in `packages/wrapper/src/commands/ask.ts`.
- [x] Issue #93 raw input preservation fixed and tested.
- [x] Issue #94 bounded brief summaries implemented and tested.
- [x] `aco doctor` v1 added as local-only, non-network, no real provider invocation.
- [x] Run/session artifact v1 documented.
- [x] `docs/security.md` added without overclaiming sandboxing, secret scanning, provider isolation, or `.acoignore` enforcement.
- [x] README, docs index, architecture, runbook, context sync docs, case study, roadmap, and package metadata refreshed.
- [x] Required `docs/images/*.svg` refreshed and XML-validated.
- [x] Generic `/aco` command and `aco-delegation` skill remain the Claude Code UX; no `/aco:*` command sprawl added.
- [x] Mock no-auth demo commands documented and smoke-tested.
- [x] Multi-perspective review completed and P1 findings resolved.

## Release risk checklist

- [x] No real Codex/Gemini calls made during validation.
- [x] No session artifacts under `~/.aco` committed.
- [x] `.acoignore.example` is documented as policy/example only.
- [x] `brief` is documented as bounded, not redacted.
- [x] `doctor` is documented as local heuristics, not remote auth verification.
- [x] `save-only` does not print provider body.
- [x] `full` output remains explicit opt-in.
- [x] Default ask permission profile remains `restricted`.

## Commit checklist

- [ ] Stage only Goal 2 relevant files.
- [ ] Commit with a focused conventional title.
- [ ] Commit body explains why/what changed in Korean.
- [ ] Include AI trailers required by repository policy.
