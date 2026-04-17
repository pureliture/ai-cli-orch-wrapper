---
name: gh-issue
description: "Create a GitHub issue with conventional commit title, type/sprint/priority labels, and Project #3 Backlog assignment"
allowed-tools: [Bash]
---

Create a GitHub issue in `pureliture/ai-cli-orch-wrapper` following the conventional commit title format, with appropriate labels and automatic Project #3 Backlog assignment.

## Steps

1. Ask the user for the following information if not already provided:
   - **Title**: Full issue title in `type: description` format. Valid types: `feat`, `fix`, `bug`, `chore`, `task`, `spike`, `epic`. Example: `feat: add gh-pm-workflow-commands`. Do NOT use `[Sprint V3][Task]` prefix — that convention is deprecated as of V3.
   - **Sprint label**: The sprint label to apply (e.g., `sprint:v3` or `sprint:v4`). If not provided, ask before creating the issue rather than assuming a sprint.
   - **Priority**: If the user explicitly mentions urgency (e.g., "critical", "blocking", "low priority"), map it to `p0`/`p1`/`p2` accordingly. Otherwise, default to `p1` without asking.
   - **Parent epic** (optional): Epic issue number to link as parent (e.g., `22`)

2. Infer the `type:*` label from the title prefix:
   - `feat:` → `type:feature`
   - `fix:` or `bug:` → `type:bug`
   - `chore:` → `type:chore`
   - `task:` → `type:task`
   - `spike:` → `type:spike`
   - `epic:` → `type:epic`

3. Construct the issue body:
   - If a parent epic number was provided, the first line of the body MUST be: `Parent epic: #<N>`
   - Otherwise, leave the body empty.

4. Create the issue:
   ```bash
   gh issue create \
     --repo pureliture/ai-cli-orch-wrapper \
     --title "<title>" \
     --label "<type-label>,<sprint-label>,<priority>" \
     --body "<body>"
   ```
   Where `<priority>` is one of `p0`, `p1`, or `p2` (default: `p1` if not specified).

5. Capture the created issue URL from the output.

6. Add the issue to Project #3 and set fields:
   Add to project and capture the item ID:
   ```bash
   ITEM_ID=$(gh project item-add 3 --owner pureliture --url <issue_url> --format json --jq '.id')
   ```
   Set **Status=Backlog** (a490720c):
   ```bash
   gh project item-edit --project-id PVT_kwHOA6302M4BT5fA --id "$ITEM_ID" \
     --field-id PVTSSF_lAHOA6302M4BT5fAzhBFN48 --single-select-option-id a490720c
   ```
   Set **Priority** (mapping `p0`→65dd5d04, `p1`→ed47fdcf, `p2`→6eb1a525):
   ```bash
   gh project item-edit --project-id PVT_kwHOA6302M4BT5fA --id "$ITEM_ID" \
     --field-id PVTSSF_lAHOA6302M4BT5fAzhBFN_U --single-select-option-id <priority-option-id>
   ```

7. If a parent epic was provided, establish native sub-issue linkage:
   - Get node IDs for both issues:
     ```bash
     PARENT_ID=$(gh issue view <parent-N> --repo pureliture/ai-cli-orch-wrapper --json id -q .id)
     CHILD_ID=$(gh issue view <issue_url> --repo pureliture/ai-cli-orch-wrapper --json id -q .id)
     ```
   - Call GraphQL to add sub-issue:
     ```bash
     gh api graphql -f query='
       mutation($parent: ID!, $child: ID!) {
         addSubIssue(input: {issueId: $parent, subIssueId: $child}) {
           issue { title }
         }
       }' -f parent="$PARENT_ID" -f child="$CHILD_ID"
     ```
   - If this step fails, print a warning `⚠ Native epic linkage failed — body reference maintained` and continue. Do NOT fail the command.

8. Report the created issue URL and number to the user.
