---
name: gh-pr
description: "Create a GitHub Pull Request with substantive body, Project status management, and tracking label inheritance"
allowed-tools: [Bash]
---

Create a GitHub Pull Request in `pureliture/ai-cli-orch-wrapper`. The PR body must be substantive — not boilerplate. Derive content from the linked issue and the actual changes made.

## Steps

1. Ask the user for the following if not already provided:
   - **Issue number** (N): The issue this PR closes
   - **Parent epic number** (optional): If this issue has a parent epic

2. Fetch context to write the body:
   ```bash
   gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json title,body,labels
   ```
   Also look at the actual changes: `git diff main...HEAD --stat` and `git log main...HEAD --oneline`.

3. Derive the PR title from the issue title:
   - Issue title format: `type: description` (e.g., `feat: add gh-pm-workflow-commands`)
   - PR title format: `type(scope): description` where scope is the affected area (e.g., `feat(pm-harness): add /gh-* pm workflow commands`)
   - Keep it under 72 characters.

4. Construct the PR body using the template below. Fill every section — do NOT leave placeholder text.

   ```
   Closes #<N>

   ## What

   <2–4 sentences describing what changed. Be specific: name the files, commands,
   or behaviors that are new or different. A reviewer who hasn't read the issue
   should understand the change from this paragraph alone.>

   ## Why

   <1–3 sentences explaining the motivation. Reference the issue context or the
   problem it solves. Avoid restating the title — add the "because" that isn't
   obvious from the title.>

   ## Changes

   <Bullet list of the concrete changes included in this PR. One line per logical
   change. Start each bullet with a verb (Add, Fix, Update, Remove, Refactor).
   Example:
   - Add `templates/commands/gh-issue.md` slash command
   - Fix `setup-github-labels.sh` to propagate upsert failures via exit code
   - Update `docs/pm-board.md` with V3 title convention and 3-axis command structure>

   ## Checklist
   - [ ] npm test passes
   - [ ] manual smoke test
   - [ ] docs updated if needed
   ```

   If a parent epic number was provided, append:
   ```

   > Note: manually check parent epic #<epic-N> checkbox after merge
   ```

5. Quality bar — before calling `gh pr create`, verify:
   - "What" section has at least 2 sentences and names specific artifacts
   - "Why" section explains motivation beyond restating the title
   - "Changes" has at least one bullet per logical unit of work
   - No section contains placeholder text like `<...>` or `TODO`

6. Create the PR:
   ```bash
   gh pr create \
     --repo pureliture/ai-cli-orch-wrapper \
     --title "<title>" \
     --body "<body>"
   ```
   Capture the PR URL from the output (e.g., `https://github.com/pureliture/ai-cli-orch-wrapper/pull/<PR_NUM>`).

7. Add PR to Project #3 and set status to "In Review":
   Resolve the PR number first:
   ```bash
   gh pr view <pr_url> --repo pureliture/ai-cli-orch-wrapper --json number -q .number
   ```
   Add the PR to Project #3:
   ```bash
   gh project item-add 3 --owner pureliture --url <pr_url>
   ```
   Then find the PR's Project item ID by PR number, retrying up to 5 times with a short sleep because Projects indexing can lag immediately after `item-add`:
   ```bash
   gh project item-list 3 --owner pureliture --format json --limit 500 \
     --jq ".items[] | select(.content.number == <pr_number> and .content.type == \"PullRequest\") | .id"
   ```
   If the project may contain more than 500 items, retry with a higher `--limit` before assuming the item is absent. Once an ID is found, set status:
   ```bash
   gh project item-edit \
     --project-id PVT_kwHOA6302M4BT5fA \
     --id <pr_item_id> \
     --field-id PVTSSF_lAHOA6302M4BT5fAzhBFN48 \
     --single-select-option-id 961ca78f
   ```
   If no ID is found after retries, or any step fails, print `⚠ PR Project status update failed — update manually` and continue.

8. Set linked issue status to "In Review":
   Parse the PR body for ALL occurrences of `Closes #N`, `Fixes #N`, or `Resolves #N` (case-insensitive). Collect all unique issue numbers in order of appearance. For each unique linked issue N:
   - Verify the issue exists: `gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json number`
   - Find the issue's Project item ID:
     ```bash
     gh project item-list 3 --owner pureliture --format json --limit 500 \
       --jq ".items[] | select(.content.number == <N> and .content.type == \"Issue\") | .id"
     ```
   - If the item is not in the Project yet, add it first: `gh project item-add 3 --owner pureliture --url https://github.com/pureliture/ai-cli-orch-wrapper/issues/<N>`
   - After adding, retry the lookup up to 5 times with a short sleep before assuming the item is absent.
   - Set status to "In Review":
     ```bash
     gh project item-edit \
       --project-id PVT_kwHOA6302M4BT5fA \
       --id <issue_item_id> \
       --field-id PVTSSF_lAHOA6302M4BT5fAzhBFN48 \
       --single-select-option-id 961ca78f
     ```
   - If any step fails for an issue, print `⚠ Issue Project status update failed for #<N> — update manually` and continue to the next linked issue.

9. Apply tracking labels to PR (inherit from linked issues; default priority `p1`):
   If any linked issue numbers were found in step 8:
   - For EACH linked issue, fetch labels: `gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json labels -q '.labels[].name'`
   - Collect all labels from all linked issues.
   - Determine the highest priority label among all discovered labels (`p0` > `p1` > `p2`). If no priority label is found on any issue, use `p1`.
   - Take the first `type:*` label found across the issues (prioritizing the first issue's type).
   - Take the first `area:*` label found across the issues (prioritizing the first issue's area).
   - Include `origin:review` if it exists on ANY of the linked issues.
   Do NOT copy `status:*` or `sprint:*` labels onto the PR.
   Inspect the PR's current labels first:
   ```bash
   gh pr view <pr_url> --repo pureliture/ai-cli-orch-wrapper --json labels -q '.labels[].name'
   ```
   Only add missing namespaces so the PR never ends up with multiple `p*`, `type:*`, or `area:*` labels. Apply each missing label with:
   ```bash
   gh pr edit <pr_url> --repo pureliture/ai-cli-orch-wrapper --add-label <label>
   ```
   If no linked issue keyword is found, skip `type:*`, `area:*`, and `origin:review`, but still apply default priority `p1`.
   If any label step fails, print `⚠ PR label sync failed — update manually` and continue.

10. Report the created PR URL to the user.
