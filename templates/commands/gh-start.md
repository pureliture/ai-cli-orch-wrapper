---
name: gh-start
description: "Transition a GitHub issue to In Progress on Project #3, apply status label, and create a local git branch"
allowed-tools: [Bash]
---

Transition a GitHub issue to "In Progress" on Project #3, add the `status:in-progress` label, and create a local git branch derived from the issue title.

## Steps

1. Parse the issue number from the argument (e.g., `/gh-start 25` → `N=25`). If not provided, ask the user for the issue number. Validate that `N` is a positive integer — if not, report an error and stop.

2. Fetch the issue title and URL:
   ```bash
   gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json title,url,labels
   ```
   Save the title and URL from the output.

3. Find the project item ID for this issue in Project #3:
   ```bash
   gh project item-list 3 --owner pureliture --format json --limit 500 --jq '.items[] | select(.content.number == <N> and .content.type == "Issue") | .id'
   ```
   Save the command output as the item ID. This uses `--jq` to select the matching issue by `content.number` instead of manually searching the full JSON. `--limit 500` only searches the first 500 returned items; if no item ID is returned and the project may contain more than 500 items, retry with a higher `--limit` before assuming the issue is absent. If no match is found, warn the user that the issue may not have been added to Project #3 yet, add it first with `gh project item-add 3 --owner pureliture --url <issue_url>`, then retry the item-list lookup.

4. Update the project item status to "In Progress":
   ```bash
   gh project item-edit \
     --project-id PVT_kwHOA6302M4BT5fA \
     --id <item-id> \
     --field-id PVTSSF_lAHOA6302M4BT5fAzhBFN48 \
     --single-select-option-id 68368c4f
   ```

5. Add the `status:in-progress` label to the issue:
   ```bash
   gh issue edit <N> --repo pureliture/ai-cli-orch-wrapper --add-label status:in-progress
   ```

6. Derive the branch slug from the issue title:
   - Fetch the title safely into a variable using command substitution: `TITLE=$(gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json title -q .title)`
   - Convert non-ASCII characters to ASCII: `printf '%s' "$TITLE" | iconv -t ASCII//TRANSLIT 2>/dev/null || printf '%s' "$TITLE"`
   - Lowercase the result
   - Replace any non-alphanumeric characters (except hyphens) with `-`
   - Collapse consecutive hyphens into one
   - **Truncate to 40 characters first**, then strip any resulting leading/trailing hyphens (truncation before strip prevents trailing-hyphen artefacts)
   - The result is the slug

7. Determine the branch type prefix from the issue's `type:*` label:
   - `type:feature` → `feat`
   - `type:bug` → `fix`
   - `type:chore` → `chore`
   - `type:task` → `feat`
   - `type:spike` → `spike`
   - If no type label found → `feat`

8. Create the branch:
   ```bash
   git checkout -b <type>/<N>-<slug>
   ```
   Example: `feat/25-add-gh-pm-workflow-commands`

9. Report the branch name and confirm the issue is now In Progress.
