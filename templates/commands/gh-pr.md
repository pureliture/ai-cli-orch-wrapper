---
name: gh-pr
description: "Create a GitHub Pull Request with substantive body, Project status management, and priority label inheritance"
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
   ```bash
   gh project item-add 3 --owner pureliture --url <pr_url>
   ```
   Then find the PR's Project item ID:
   ```bash
   gh project item-list 3 --owner pureliture --format json --limit 500 \
     --jq ".items[] | select(.content.url == \"<pr_url>\") | .id"
   ```
   If no ID is returned and the project may contain more than 500 items, retry with a higher `--limit` before assuming the item is absent. Then set status:
   ```bash
   gh project item-edit \
     --project-id PVT_kwHOA6302M4BT5fA \
     --id <pr_item_id> \
     --field-id PVTSSF_lAHOA6302M4BT5fAzhBFN48 \
     --single-select-option-id 961ca78f
   ```
   If any step fails, print `⚠ PR Project status update failed — update manually` and continue.

8. Set linked issue status to "In Review":
   Parse the PR body for `Closes #N`, `Fixes #N`, or `Resolves #N` (case-insensitive). If found:
   - Verify the issue exists: `gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json number`
   - Find the issue's Project item ID:
     ```bash
     gh project item-list 3 --owner pureliture --format json --limit 500 \
       --jq ".items[] | select(.content.number == <N> and .content.type == \"Issue\") | .id"
     ```
     If no ID is returned and the project may contain more than 500 items, retry with a higher `--limit`.
   - If the item is not in the Project yet, add it first: `gh project item-add 3 --owner pureliture --url https://github.com/pureliture/ai-cli-orch-wrapper/issues/<N>`
   - Set status to "In Review":
     ```bash
     gh project item-edit \
       --project-id PVT_kwHOA6302M4BT5fA \
       --id <issue_item_id> \
       --field-id PVTSSF_lAHOA6302M4BT5fAzhBFN48 \
       --single-select-option-id 961ca78f
     ```
   - If no linked issue keyword found, skip this step silently.
   - If any step fails, print `⚠ Issue Project status update failed — update manually` and continue.

9. Apply priority label to PR (inherit from linked issue, default `p1`):
   If a linked issue number N was found in step 8:
   ```bash
   gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json labels -q '.labels[].name'
   ```
   Find the first label matching `p0`, `p1`, or `p2`. If none found or no linked issue, use `p1`.
   Apply to PR:
   ```bash
   gh pr edit <pr_url> --repo pureliture/ai-cli-orch-wrapper --add-label <priority>
   ```
   If multiple linked issues have different priorities, use the highest (`p0` > `p1` > `p2`).

10. Report the created PR URL to the user.