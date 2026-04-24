---
name: gh-pr
description: "Create a substantive GitHub PR, set Project review state, and sync durable labels"
allowed-tools: [Bash]
---

Create a GitHub Pull Request in `pureliture/ai-cli-orch-wrapper`. Derive the PR body from the linked issue and actual changes. Project `Status` tracks review state; PR labels only mirror durable classification.

## Steps

1. Gather inputs if not already provided:
   - **Issue number** (`N`): The issue this PR closes.
   - **Parent epic number** (optional): Used only for relationship checks and user reminders.

2. Resolve Project configuration using the env-first, repository-fallback contract from `docs/reference/project-board.md`:
   ```bash
   PM_PROJECT_NUMBER="${PM_PROJECT_NUMBER:-3}"
   PM_PROJECT_ID="${PM_PROJECT_ID:-PVT_kwHOA6302M4BT5fA}"
   PM_STATUS_FIELD_ID="${PM_STATUS_FIELD_ID:-PVTSSF_lAHOA6302M4BT5fAzhBFN48}"
   PM_IN_REVIEW_OPTION_ID="${PM_IN_REVIEW_OPTION_ID:-961ca78f}"
   ```

3. Fetch context for the linked issue and actual branch changes:
   ```bash
   gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json title,body,labels,url
   git diff main...HEAD --stat
   git diff main...HEAD --name-only
   git log main...HEAD --oneline
   ```

4. Derive the PR title from the actual change, not mechanically from the issue type:
   - Linked issue titles use `epic: <summary>`, `task: <summary>`, `bug: <summary>`, or `chore: <summary>`.
   - PR title format is conventional commit style: `feat(scope): <summary>`, `fix(scope): <summary>`, `chore(scope): <summary>`, or `docs(scope): <summary>`.
   - Use `fix` for bug fixes, `docs` for docs-only changes, `chore` for maintenance-only changes, and `feat` for user-visible or workflow capability changes.
   - Scope should come from the changed area, such as `commands`, `docs`, `wrapper`, `infra`, or a package name.
   - Keep the title under 72 characters when practical.

5. Construct a substantive PR body and write it to a temporary file:
   ```markdown
   Closes #<N>

   ## What

   <2-4 concrete sentences naming changed files, commands, or behavior.>

   ## Why

   <1-3 sentences explaining the motivation from the issue and repository context.>

   ## Changes

   - <Verb> <concrete logical change>

   ## Checklist

   - [ ] Relevant tests or smoke checks pass
   - [ ] Docs updated if behavior changed
   - [ ] Project status and labels verified
   ```
   If a parent epic was provided, append `> Note: check parent epic #<epic-N> child checklist after merge`.

6. Quality bar before creating the PR:
   - `What` names specific artifacts and has at least 2 sentences.
   - `Why` explains motivation beyond restating the title.
   - `Changes` includes one bullet per logical unit of work.
   - No section contains placeholder text or unfilled template prose.

7. Create the PR with `--body-file`:
   ```bash
   BODY_FILE=$(mktemp)
   trap 'rm -f "$BODY_FILE"' EXIT
   cat > "$BODY_FILE" <<'_GH_PR_BODY_'
   <completed PR body>
   _GH_PR_BODY_

   PR_URL=$(gh pr create \
     --repo pureliture/ai-cli-orch-wrapper \
     --title "<conventional PR title>" \
     --body-file "$BODY_FILE")
   PR_NUMBER=$(gh pr view "$PR_URL" --repo pureliture/ai-cli-orch-wrapper --json number -q .number)
   ```

8. Add the PR to the Project and set PR `Status=In Review`. Warn and continue if Project item add or update fails:
   ```bash
   gh project item-add "$PM_PROJECT_NUMBER" --owner pureliture --url "$PR_URL" >/dev/null || echo "⚠ PR Project add failed — update manually"

   PR_ITEM_ID=""
   for attempt in 1 2 3 4 5; do
     PR_ITEM_ID=$(gh project item-list "$PM_PROJECT_NUMBER" --owner pureliture --format json --limit 500 \
       --jq ".items[] | select(.content.number == $PR_NUMBER and .content.type == \"PullRequest\") | .id")
     [ -n "$PR_ITEM_ID" ] && break
     sleep 2
   done

   if [ -n "$PR_ITEM_ID" ]; then
     gh project item-edit --project-id "$PM_PROJECT_ID" --id "$PR_ITEM_ID" \
       --field-id "$PM_STATUS_FIELD_ID" \
       --single-select-option-id "$PM_IN_REVIEW_OPTION_ID" \
       || echo "⚠ PR Project status update failed — update manually"
   else
     echo "⚠ PR Project item lookup failed — update manually"
   fi
   ```

9. Move every linked issue item to `Status=In Review`:
   - Parse the PR body for all `Closes #N`, `Fixes #N`, and `Resolves #N` references, case-insensitive.
   - Deduplicate issue numbers in order of appearance.
   - For each linked issue, ensure it is in the Project, retry item lookup up to 5 times, then set `Status=In Review`.
   - If any linked issue update fails, print `⚠ Issue Project status update failed for #<N> — update manually` and continue.

10. Sync PR labels from linked issues using only durable classification:
    - Fetch labels from every linked issue.
    - Copy `type:*`, `area:*`, and `origin:review` only.
    - Do not copy non-durable classification from linked issues.
    - Do not mirror the issue Project `Priority` field to the PR.
    - Inspect existing PR labels first and add only missing labels, avoiding duplicate `type:*` or `area:*` namespaces.
    - If no linked issue keyword is found, skip label sync.

11. If a parent epic number was provided:
    - Verify native parent/sub-issue linkage for the linked issue when supported.
    - If native linkage is missing, recommend adding it with the canonical GraphQL mutation.
    - Remind the user to check the parent epic child checklist after merge.

12. Report the PR URL, linked issues moved to `In Review`, labels synced, and any manual Project or parent follow-up warnings.
