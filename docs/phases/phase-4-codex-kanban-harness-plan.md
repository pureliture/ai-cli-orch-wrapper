# Phase 4 Plan — Codex GitHub Kanban Harness Migration

**Date:** 2026-04-24

**Prerequisites:** Phase 3 `.claude/commands/gh-*` and matching `templates/commands/gh-*` are stabilized on `github-kanban-ops`.

**Objective:** Migrate the stabilized GitHub Kanban harness from Claude-specific slash-command surfaces into Codex-native harness surfaces. Phase 4 is only about the GitHub Kanban workflow (`gh-issue`, `gh-start`, `gh-pr`, `gh-pr-followup`) and is not an OpenSpec/OPSX migration.

---

## Scope

### In Scope

- Codex-native representation of the GitHub Kanban operating model.
- Codex-native replacement for the four `/gh-*` command workflows.
- Reuse of the Phase 3 GitHub Project config contract.
- Documentation that tells Codex users how to invoke the workflows without relying on Claude slash commands.
- Compatibility notes so `.claude` users can continue using the existing Phase 3 harness during migration.

### Out of Scope

- OpenSpec or OPSX command migration.
- Reintroducing removed `*:multi` commands.
- Restoring `github-jira-ops`, sprint, spike, story, Jira, or priority/status label concepts.
- Changing GitHub Project fields, options, labels, or repository board policy.
- Creating or mutating live GitHub issues, PRs, or Project items as part of the migration itself.

---

## Source Surfaces

Phase 4 should treat these as the source inventory to migrate or reference:

| Surface | Current role | Phase 4 use |
|---------|--------------|-------------|
| `.claude/skills/github-kanban-ops/` | Claude-local canonical skill copy | Source for Claude compatibility and parity checks |
| `.agents/skills/github-kanban-ops/` | Repo-local Codex-discoverable skill copy | Recommended Codex canonical source |
| `.claude/commands/gh-issue.md` | Claude slash-command wrapper for issue creation | Source workflow for Codex `gh-issue` equivalent |
| `.claude/commands/gh-start.md` | Claude slash-command wrapper for issue start/worktree creation | Source workflow for Codex `gh-start` equivalent |
| `.claude/commands/gh-pr.md` | Claude slash-command wrapper for PR creation/review-state updates | Source workflow for Codex `gh-pr` equivalent |
| `.claude/commands/gh-pr-followup.md` | Claude slash-command wrapper for review follow-up triage | Source workflow for Codex `gh-pr-followup` equivalent |
| `templates/commands/gh-*` | Packaged Claude command templates | Parity source until packaging strategy changes |
| `docs/guides/github-workflow.md` | User-facing workflow guide | Update later with Codex invocation guidance |
| `docs/reference/project-board.md` | Project fields, options, and fallback IDs | Keep as shared config contract |

The `.claude` command files should not become the Codex source of truth after Phase 4. They remain compatibility wrappers until a later cleanup phase decides whether to keep or retire Claude command templates.

---

## Target Surfaces

Current repository inspection shows:

- `.agents/skills/github-kanban-ops/` already exists and is discoverable as a Codex skill in this workspace.
- `.codex/skills/` currently contains OpenSpec skills, but no GitHub Kanban skill.
- `.codex/agents/` contains TOML agent definitions for routing specialized work.
- There is no Codex slash-command directory equivalent to `.claude/commands/`.

### Recommended target layout

| Target | Recommendation | Reason |
|--------|----------------|--------|
| `.agents/skills/github-kanban-ops/` | Make this the canonical Codex GitHub Kanban skill | It is already repo-local, discoverable, and holds `SKILL.md`, references, scripts, and `agents/openai.yaml` |
| `.agents/skills/gh-{issue,start,pr,pr-followup}/` | Add thin Codex command-alias skills | Preserves Claude `/gh-*` muscle memory as Codex `$gh-*` without duplicating workflow policy |
| `.codex/skills/github-kanban-ops/` | Do not add initially | Avoid duplicate canonical skill copies unless Codex runtime or packaging proves `.codex/skills` is required |
| `.codex/agents/github-kanban-ops.toml` | Defer unless routing needs a dedicated agent | The skill trigger is enough for normal use; a TOML agent adds another surface to keep synchronized |
| `docs/guides/github-workflow.md` | Update during implementation | Users need non-Claude invocation examples and a mapping from old `/gh-*` commands |
| `docs/reference/project-board.md` | Keep shared | The Project config contract should stay provider-neutral |

If a future packaging or sync tool requires `.codex/skills/`, generate it from `.agents/skills/github-kanban-ops/` instead of hand-maintaining two divergent copies.

---

## Representing `/gh-*` in Codex

Codex may not support Claude slash commands directly, so Phase 4 needs a native representation for the workflows instead of copying `.claude/commands/` verbatim.

### Options

| Option | Pros | Cons |
|--------|------|------|
| Command docs only | Lowest risk; no new runtime surface | Users must manually translate docs into prompts; less reliable than skills |
| Single canonical skill workflows in `SKILL.md` | Native to the current Codex skill system; discoverable; keeps policy close to scripts and references | Usage differs too much from Claude `/gh-*`; users must remember workflow names |
| Thin `$gh-*` wrapper skills delegating to canonical skill | Preserves command-like UX while keeping policy in one place | Adds small wrapper files that must stay intentionally policy-light |
| Executable scripts | Deterministic Project operations; easier smoke tests; reusable across agents | More implementation work; shell/API edge cases; scripts still need LLM-authored titles and bodies |
| Dedicated Codex agent | Stronger routing for Kanban tasks; useful for subagent delegation | Adds another sync surface; unnecessary unless skill routing is insufficient |

### Recommended path

Use `.agents/skills/github-kanban-ops/SKILL.md` as the canonical policy source and add four explicit workflow sections:

- `Create Issue` — Codex equivalent of `/gh-issue`.
- `Start Issue` — Codex equivalent of `/gh-start`.
- `Create Pull Request` — Codex equivalent of `/gh-pr`.
- `Handle Review Follow-up` — Codex equivalent of `/gh-pr-followup`.

Expose the Claude-like Codex UX through four thin skill wrappers:

- `$gh-issue` — delegates to `Create Issue`.
- `$gh-start` — delegates to `Start Issue`.
- `$gh-pr` — delegates to `Create Pull Request`.
- `$gh-pr-followup` — delegates to `Handle Review Follow-up`.

Then update user-facing docs with a mapping table:

| Claude command | Codex skill wrapper |
|----------------|---------------------|
| `/gh-issue ...` | `$gh-issue ...` |
| `/gh-start #N` | `$gh-start #N` |
| `/gh-pr #N` | `$gh-pr #N` |
| `/gh-pr-followup #PR` | `$gh-pr-followup #PR` |

Do not initially build four standalone scripts that fully replace the LLM workflow. Keep `scripts/make_issue_body.py` as the deterministic body generator, and consider small helper scripts later only for repeated Project item lookup/update operations.

---

## Project Config Contract Reuse

Phase 4 should reuse the Phase 3 env-first, repo-fallback Project contract without changing field semantics.

### Resolution order

1. Use environment variables when present.
2. Fall back to the repository defaults documented in `docs/reference/project-board.md`.
3. If Project mutation fails, follow the command-specific warning/failure policy from Phase 3 and never delete already-created issues or PRs as cleanup.

### Current repository fallback values

```bash
export PM_PROJECT_NUMBER="3"
export PM_PROJECT_ID="PVT_kwHOA6302M4BT5fA"
export PM_STATUS_FIELD_ID="PVTSSF_lAHOA6302M4BT5fAzhBFN48"
export PM_BACKLOG_OPTION_ID="a490720c"
export PM_READY_OPTION_ID="8fc165d1"
export PM_IN_PROGRESS_OPTION_ID="68368c4f"
export PM_IN_REVIEW_OPTION_ID="961ca78f"
export PM_DONE_OPTION_ID="b36b62fa"
export PM_PRIORITY_FIELD_ID="PVTSSF_lAHOA6302M4BT5fAzhBFN_U"
export PM_P0_OPTION_ID="65dd5d04"
export PM_P1_OPTION_ID="ed47fdcf"
export PM_P2_OPTION_ID="6eb1a525"
```

### Rules to preserve

- `Status` is the workflow state.
- `Priority` is a Project field, not a label.
- Labels are durable classification only: `type:*`, `area:*`, `origin:review`.
- Forbidden label/status concepts stay forbidden: `status:*`, `sprint:*`, `p0`/`p1`/`p2`, `size:*`, `type:feature`, `type:story`, `type:spike`.
- Project item lookup should keep the Phase 3 retry behavior for GitHub Projects indexing lag.

---

## `.aco-worktrees` Naming

Phase 3 intentionally kept `.aco-worktrees/fix-<N>` while deferring the naming decision.

### Options

| Option | Pros | Cons |
|--------|------|------|
| Keep `.aco-worktrees/fix-<N>` | Maximum compatibility with existing local habits | Misleading for `task`, `epic`, and `chore` issues |
| Rename root to `.codex-worktrees/` | Provider-specific clarity | Breaks existing cleanup assumptions and overfits to Codex |
| Keep root, rename leaf to `<prefix>-<N>` | Preserves `.aco` compatibility while fixing stale `fix-*` semantics | Requires docs and command workflow updates |
| Defer all naming changes | Lowest Phase 4 risk | Leaves known confusing behavior in the Codex workflow |

### Recommendation

Keep the root directory `.aco-worktrees` and update the Codex workflow to use `.aco-worktrees/<prefix>-<N>`, where `<prefix>` is derived from the branch prefix (`fix`, `feat`, or `chore`). Do not rename the root to `.codex-worktrees`; this repository still treats `aco` as the cross-provider wrapper namespace.

Compatibility note: the Claude `/gh-start` wrapper can keep `.aco-worktrees/fix-<N>` until a later compatibility update, or it can be changed in the same implementation phase only if both `.claude/commands/gh-start.md` and `templates/commands/gh-start.md` are intentionally kept in parity.

---

## Deliverables

1. Update `.agents/skills/github-kanban-ops/SKILL.md` with Codex-native workflow sections for the four `gh-*` operations.
2. Add `.agents/skills/gh-*` thin wrappers so Codex users can invoke `$gh-issue`, `$gh-start`, `$gh-pr`, and `$gh-pr-followup`.
3. Keep `.agents/skills/github-kanban-ops/references/github-kanban-model.md` as the workflow policy reference; update only if migration reveals missing Codex-specific constraints.
4. Reuse `.agents/skills/github-kanban-ops/scripts/make_issue_body.py` from all Codex issue-creation workflows.
5. Update `docs/guides/github-workflow.md` to explain Codex invocation patterns and distinguish Claude slash commands from Codex skill workflows.
6. Optionally add `.codex/agents/github-kanban-ops.toml` only if implementation testing shows Codex routing does not reliably select the skill.
7. Leave `.claude/commands/gh-*` and `templates/commands/gh-*` intact unless the implementation explicitly chooses a compatibility sync step.

---

## Non-Goals

- Do not implement OpenSpec/OPSX Codex parity in this phase.
- Do not create new GitHub Project fields or labels.
- Do not convert GitHub Project state back into labels.
- Do not make `.codex/skills` a duplicate source of truth without a concrete runtime requirement.
- Do not delete `.claude` command surfaces during Phase 4.
- Do not perform live GitHub issue/PR mutations during validation unless the user explicitly asks for an end-to-end smoke test.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Duplicate skill copies drift | Codex and Claude behavior diverge | Keep `.agents/skills/github-kanban-ops` canonical for Codex; treat `.claude` as compatibility |
| Slash-command expectations leak into Codex | Users try `/gh-*` where unsupported | Document prompt mappings and workflow names |
| Project ID fallbacks become stale | Project updates fail or target wrong board | Keep env-first contract and cite `docs/reference/project-board.md` as the maintained fallback source |
| LLM over-automates GitHub mutations | Accidental issues or Project edits | Skill must require context inspection and report before/after mutation results |
| Worktree naming change breaks local scripts | Users cannot find existing worktrees | Keep `.aco-worktrees` root and only normalize new leaf names |
| Native parent/sub-issue API limitations | Parent linkage silently incomplete | Keep body `Parent` fallback and epic checklist best-effort behavior |
| Review follow-up creates vague issues | Backlog quality regresses | Keep generator quality bar and require acceptance criteria/definition of done |

---

## Validation Plan

Validation should be local and non-mutating by default.

1. Check file inventory:
   ```bash
   find .agents/skills/github-kanban-ops .codex/skills .codex/agents -maxdepth 3 -type f | sort
   ```
2. Verify the issue body generator still works:
   ```bash
   python3 .agents/skills/github-kanban-ops/scripts/make_issue_body.py --help
   ```
3. Smoke-generate sample bodies for `epic`, `task`, `bug`, and `chore` into temporary files and verify no placeholder text remains.
4. Grep for forbidden legacy concepts in the migrated Codex surfaces:
   ```bash
   rg "github-jira-ops|type:feature|type:story|type:spike|status:|sprint:|\\bp[012]\\b" .agents/skills/github-kanban-ops docs/guides/github-workflow.md
   ```
   Review matches manually because examples may mention forbidden terms only as explicit prohibitions.
5. Verify Codex invocation docs include mappings for all four old `/gh-*` commands.
6. If a `.codex/agents/github-kanban-ops.toml` file is added, validate it matches existing `.codex/agents/*.toml` format.
7. Do not run live `gh issue create`, `gh pr create`, or `gh project item-edit` during normal validation.

---

## Rollback and Compatibility

- Claude users can continue using `.claude/commands/gh-*` throughout Phase 4.
- If Codex skill migration causes confusion, revert the `.agents/skills/github-kanban-ops/SKILL.md` workflow edits and keep the Phase 3 Claude command docs as the operational fallback.
- If a new `.codex/agents/github-kanban-ops.toml` is added and routing is noisy, remove only that agent file; the skill remains usable directly.
- If `.aco-worktrees/<prefix>-<N>` creates local compatibility issues, document the new naming as Codex-only and leave existing `.aco-worktrees/fix-<N>` worktrees untouched.
- Project config rollback is documentation-only: keep using env vars or the fallback IDs from `docs/reference/project-board.md`.

---

## Execution Sequence

This sequence is suitable for a subagent or collaborator to execute later:

1. Re-read Phase 3 plan, `docs/guides/github-workflow.md`, `docs/reference/project-board.md`, and both `github-kanban-ops` skill copies.
2. Confirm current git status and avoid reverting unrelated Phase 3 edits.
3. Update `.agents/skills/github-kanban-ops/SKILL.md` with the four Codex workflow sections.
4. Replace Claude command path examples inside the Codex workflow with `.agents/skills/github-kanban-ops/scripts/make_issue_body.py`.
5. Add Codex prompt mappings to `docs/guides/github-workflow.md`.
6. Decide whether `.codex/agents/github-kanban-ops.toml` is needed; add it only if skill routing is insufficient.
7. Apply `.aco-worktrees/<prefix>-<N>` naming in Codex workflow docs while preserving `.aco-worktrees` root.
8. Run the local validation plan and inspect grep matches manually.
9. Summarize changed surfaces, compatibility behavior, and any deferred follow-up decisions.
