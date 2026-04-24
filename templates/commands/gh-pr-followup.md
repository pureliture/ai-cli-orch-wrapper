---
name: gh-pr-followup
description: "Resolve PR review threads or defer them into canonical follow-up issues"
allowed-tools: [Bash]
---

Fetch unresolved review threads for a Pull Request, resolve small actionable feedback immediately, or defer larger work into canonical GitHub issues with `origin:review`.

## Steps

1. Ask for the Pull Request number (`PR_NUMBER`) if it was not provided.

2. Resolve Project configuration using the env-first, repository-fallback contract from `docs/reference/project-board.md`:
   ```bash
   PM_PROJECT_NUMBER="${PM_PROJECT_NUMBER:-3}"
   PM_PROJECT_ID="${PM_PROJECT_ID:-PVT_kwHOA6302M4BT5fA}"
   PM_STATUS_FIELD_ID="${PM_STATUS_FIELD_ID:-PVTSSF_lAHOA6302M4BT5fAzhBFN48}"
   PM_BACKLOG_OPTION_ID="${PM_BACKLOG_OPTION_ID:-a490720c}"
   PM_PRIORITY_FIELD_ID="${PM_PRIORITY_FIELD_ID:-PVTSSF_lAHOA6302M4BT5fAzhBFN_U}"
   PM_P0_OPTION_ID="${PM_P0_OPTION_ID:-65dd5d04}"
   PM_P1_OPTION_ID="${PM_P1_OPTION_ID:-ed47fdcf}"
   PM_P2_OPTION_ID="${PM_P2_OPTION_ID:-6eb1a525}"
   ```

3. Fetch unresolved review threads:
   ```bash
   gh api graphql -F owner="pureliture" -F name="ai-cli-orch-wrapper" -F number="$PR_NUMBER" -f query='
   query($owner: String!, $name: String!, $number: Int!) {
     repository(owner: $owner, name: $name) {
       pullRequest(number: $number) {
         reviewThreads(first: 50) {
           nodes {
             id
             isResolved
             comments(first: 10) {
               nodes {
                 id
                 body
                 path
                 line
               }
             }
           }
         }
       }
     }
   }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
   ```

4. Categorize each unresolved thread:
   - **Immediate fix**: Small, localized change that belongs in the current PR.
   - **Deferred issue**: Larger task, bug, or maintenance follow-up that should be tracked separately.
   - If unsure, ask whether to fix now or defer.

5. For each immediate fix:
   - Make the local code change.
   - Reply to the review thread with a concise description of the fix.
   - Resolve the thread:
     ```bash
     gh api graphql -f query='mutation($id: ID!, $body: String!) {
       addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $id, body: $body}) {
         clientMutationId
       }
     }' -F id="$THREAD_ID" -F body="$REPLY_BODY"

     gh api graphql -f query='mutation($id: ID!) {
       resolveReviewThread(input: {threadId: $id}) {
         thread { isResolved }
       }
     }' -F id="$THREAD_ID"
     ```

6. For each deferred issue, gather or infer:
   - **Issue type**: One of `task`, `bug`, or `chore` only.
   - **Summary/title**: Concise title text without the type prefix.
   - **Area label**: Optional `area:*` if the affected area is clear from file paths or review context.
   - **Priority**: Assess `P0`, `P1`, or `P2` for the Project `Priority` field. If context is insufficient, ask one brief question; if deferring must continue without asking, leave Priority unset and report a triage warning.
   - **Body context**: Include the review comment, affected path/line, why it is deferred, scope, and acceptance criteria.

7. Generate each deferred issue body with the canonical generator and substantive arguments:
   ```bash
   python3 .claude/skills/github-kanban-ops/scripts/make_issue_body.py \
     --type "<task|bug|chore>" \
     --title "<summary>" \
     --summary "<specific review follow-up summary>" \
     --outcome "<expected result after follow-up>" \
     --scope "<deferred scope and affected files>" \
     --acceptance "[ ] <observable completion condition>" \
     --notes "From PR #<PR_NUMBER> review thread <thread-id>. See also: #<PR_NUMBER>" \
     --format body
   ```
   For bug follow-ups, also pass `--actual`, `--expected`, `--impact`, and `--reproduction` when the review context identifies broken behavior.

8. Create each deferred issue with durable labels only:
   ```bash
   BODY_FILE=$(mktemp)
   trap 'rm -f "$BODY_FILE"' EXIT
   cat > "$BODY_FILE" <<'_GH_REVIEW_FOLLOWUP_BODY_'
   <generated body>
   _GH_REVIEW_FOLLOWUP_BODY_

   LABELS="type:<type>,origin:review"
   [ -n "<area-label>" ] && LABELS="$LABELS,<area-label>"

   ISSUE_URL=$(gh issue create \
     --repo pureliture/ai-cli-orch-wrapper \
     --title "<type>: <summary>" \
     --label "$LABELS" \
     --body-file "$BODY_FILE")
   ```

9. Add each deferred issue to the Project and set `Status=Backlog`. Warn and continue if Project item add fails; report status update failure as a workflow warning:
   ```bash
   ITEM_ID=$(gh project item-add "$PM_PROJECT_NUMBER" --owner pureliture --url "$ISSUE_URL" --format json --jq '.id' 2>/dev/null || true)

   if [ -n "$ITEM_ID" ]; then
     gh project item-edit --project-id "$PM_PROJECT_ID" --id "$ITEM_ID" \
       --field-id "$PM_STATUS_FIELD_ID" \
       --single-select-option-id "$PM_BACKLOG_OPTION_ID" \
       || echo "⚠ Deferred issue Project status update failed — update manually"
   else
     echo "⚠ Deferred issue Project item add failed — update manually"
   fi
   ```

10. If Priority was assessed, set the Project `Priority` field only. If Priority is unset, print `⚠ Priority unset for deferred issue — triage needed`:
    ```bash
    case "<priority>" in
      P0) PRIORITY_OPTION_ID="$PM_P0_OPTION_ID" ;;
      P1) PRIORITY_OPTION_ID="$PM_P1_OPTION_ID" ;;
      P2) PRIORITY_OPTION_ID="$PM_P2_OPTION_ID" ;;
      *) PRIORITY_OPTION_ID="" ;;
    esac

    if [ -z "${ITEM_ID:-}" ]; then
      echo "⚠ Deferred issue Priority update skipped — Project item missing"
    elif [ -n "$PRIORITY_OPTION_ID" ]; then
      gh project item-edit --project-id "$PM_PROJECT_ID" --id "$ITEM_ID" \
        --field-id "$PM_PRIORITY_FIELD_ID" \
        --single-select-option-id "$PRIORITY_OPTION_ID" \
        || echo "⚠ Deferred issue Priority update failed — update manually"
    else
      echo "⚠ Priority unset for deferred issue — triage needed"
    fi
    ```

11. Summarize resolved threads, deferred issue URLs, Project updates, Priority results, and any warnings.
