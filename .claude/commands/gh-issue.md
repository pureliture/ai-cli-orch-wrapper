---
name: gh-issue
description: "Create a GitHub issue with conventional commit title, type/priority labels, and Project #3 Backlog assignment"
allowed-tools: [Bash]
---

Create a GitHub issue in `pureliture/ai-cli-orch-wrapper` following the conventional commit title format, with appropriate labels and automatic Project #3 Backlog assignment.

## Steps

1. Ask the user for the following information if not already provided:
   - **Title**: Full issue title in `type: description` format. Valid types: `feat`, `fix`, `bug`, `chore`, `task`, `spike`, `epic`. Example: `feat: add gh-pm-workflow-commands`.
   - **Priority**: If the user explicitly mentions urgency (e.g., "critical", "blocking", "low priority"), map it to `p0`/`p1`/`p2` accordingly. Otherwise, default to `p1` without asking.
   - **Additional labels** (optional): Extra labels to apply (e.g., `documentation`). Use `documentation` for docs-related issues.
   - **Parent epic** (optional): Epic issue number to link as parent (e.g., `22`)
   - **Body context**: Goal/problem, concrete scope, completion criteria, and any constraints or references. If the user provided enough context, infer these sections. If any required section would be vague, ask at most 2 concise follow-up questions before creating the issue.
   - **Language**: Write issue body content and any follow-up questions in Korean by default. Keep conventional title prefixes, labels, code identifiers, file paths, command names, and established Markdown headings in their original language. If the user explicitly asks for another language, follow that request.

2. Infer the `type:*` label from the title prefix:
   - `feat:` → `type:feature`
   - `fix:` or `bug:` → `type:bug`
   - `chore:` → `type:chore`
   - `task:` → `type:task`
   - `spike:` → `type:spike`
   - `epic:` → `type:epic`

3. Construct a complete issue body:
   - If a parent epic number was provided, the first line of the body MUST be: `Parent epic: #<N>`
   - Include the following sections after the optional parent epic line:
     ```markdown
     ## Purpose
     <1-3 sentences explaining the problem or goal. Do not merely repeat the title.>

     ## Scope & Requirements
     - [ ] <Concrete requirement or task>
     - [ ] <Concrete requirement or task>

     ## Acceptance Criteria
     - [ ] <Observable completion condition>
     ```
   - Add `## Notes` only when there are useful constraints, links, implementation hints, or explicit non-goals.
   - Write the prose and checklist item descriptions in Korean by default.
   - For `bug:` or `fix:` issues, use concrete behavior in `Scope & Requirements`; include reproduction details in `## Notes` when available.
   - For `spike:` issues, make `Acceptance Criteria` describe the expected decision, research note, or recommendation.
   - For `epic:` issues, include child issue planning in `Scope & Requirements`.

4. Quality bar — before creating the issue, verify:
   - `## Purpose`, `## Scope & Requirements`, and `## Acceptance Criteria` are present.
   - `Purpose` explains why the work matters and does not only restate the title.
   - `Scope & Requirements` has at least 2 checklist items unless this is a tiny bug.
   - `Acceptance Criteria` has at least 1 observable completion condition.
   - Body prose and checklist item descriptions are Korean by default unless the user explicitly requested another language.
   - No section contains placeholder text like `<...>`, `TBD`, or `TODO`.
   - If a parent epic was provided, `Parent epic: #<N>` remains the first line.

5. Write the body to a temporary Markdown file. Use `--body-file` rather than inline `--body` so multiline Markdown, checkboxes, and backticks are preserved:
   ```bash
   BODY_FILE=$(mktemp)
   trap 'rm -f "$BODY_FILE"' EXIT
   cat > "$BODY_FILE" <<'_CLAUDE_GH_ISSUE_BODY_'
   <body>
   _CLAUDE_GH_ISSUE_BODY_
   ```

6. Create the issue:
   ```bash
   gh issue create \
     --repo pureliture/ai-cli-orch-wrapper \
     --title "<title>" \
     --label "$LABELS" \
     --body-file "$BODY_FILE"
   ```
   Where `<priority>` is one of `p0`, `p1`, or `p2` (default: `p1` if not specified).
   Construct `LABELS` to avoid trailing commas when `additional-labels` is empty:
   ```bash
   BASE_LABELS="<type-label>,<priority>"
   if [ -n "<additional-labels>" ]; then
     LABELS="$BASE_LABELS,<additional-labels>"
   else
     LABELS="$BASE_LABELS"
   fi
   ```

7. Capture the created issue URL from the output.

8. Add the issue to Project #3 and set fields:
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

9. If a parent epic was provided, establish native sub-issue linkage:
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

10. Report the created issue URL and number to the user.
