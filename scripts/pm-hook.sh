#!/usr/bin/env bash
# pm-hook.sh — Claude Code PostToolUse hook (FALLBACK / SAFETY-NET)
#
# Role: idempotent fallback for /gh-pr and manual 'gh pr create' runs.
#   - /gh-pr template handles Project status directly as primary path.
#   - This hook re-runs the same operations idempotently as a safety net:
#     * for manual 'gh pr create' bypassing the /gh-pr command
#     * when /gh-pr template steps fail or are skipped
#     * to guarantee convergence regardless of how a PR was created
#
# Detects 'gh pr create' and moves the created PR plus linked issue to "In Review"
# in GitHub Projects V2. Also inherits priority label from linked issue (default: p1).
#
# Payload (stdin JSON):
#   { "tool_name": "Bash", "tool_input": { "command": "..." }, ... }
#
# Config (set in shell rc or .claude/settings.local.json env after Projects setup):
#   PM_PROJECT_NUMBER      — Project number shown in URL (e.g., 3)
#   PM_PROJECT_ID          — Projects V2 node ID (GUID)
#   PM_STATUS_FIELD_ID     — Status field node ID
#   PM_IN_REVIEW_OPTION_ID — "In Review" option node ID
#
# Run 'bash scripts/setup-project-ids.sh' after Projects V2 setup to get IDs.

set -uo pipefail

# ── Read stdin payload once ────────────────────────────────────────────────
PAYLOAD=$(cat)

# ── Parse JSON via jq (handles multiline commands safely) ─────────────────
TOOL_NAME=$(printf '%s' "$PAYLOAD" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
COMMAND=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# ── Fast path: exit immediately if not Bash or not gh pr create ───────────
[[ "$TOOL_NAME" != "Bash" ]] && exit 0
[[ "$COMMAND" =~ (^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$) ]] || exit 0

# ── Derive owner/repo from git remote ─────────────────────────────────────
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
[[ -z "$REMOTE" ]] && exit 0

# Normalize SSH (git@github.com:owner/repo.git) and HTTPS URLs
REPO=$(echo "$REMOTE" \
  | sed -E 's|git@github\.com:||; s|https://github\.com/||; s|\.git$||')
OWNER=$(echo "$REPO" | cut -d'/' -f1)

[[ -z "$OWNER" || -z "$REPO" ]] && exit 0

# ── Config check ───────────────────────────────────────────────────────────
PROJECT_NUMBER="${PM_PROJECT_NUMBER:-}"
PROJECT_ID="${PM_PROJECT_ID:-}"        # Node ID (GUID) — needed for item-edit
STATUS_FIELD_ID="${PM_STATUS_FIELD_ID:-}"
IN_REVIEW_OPTION_ID="${PM_IN_REVIEW_OPTION_ID:-}"
if [[ -z "$PROJECT_NUMBER" || -z "$PROJECT_ID" || -z "$STATUS_FIELD_ID" || -z "$IN_REVIEW_OPTION_ID" ]]; then
  echo "[pm-hook] Projects V2 config not set — skipping (run setup-project-ids.sh)" >&2
  exit 0
fi

# ── Extract issue number ───────────────────────────────────────────────────
ISSUE_NUM=""

# 1. From command string (immediate)
if [[ "$COMMAND" =~ [Cc]loses[[:space:]]+#([0-9]+) ]]; then
  ISSUE_NUM="${BASH_REMATCH[1]}"
elif [[ "$COMMAND" =~ [Cc]loses[[:space:]]+([0-9]+) ]]; then
  ISSUE_NUM="${BASH_REMATCH[1]}"
fi

# 2. From actual PR body (handles --fill and manual edits)
if [[ -z "$ISSUE_NUM" ]]; then
  PR_BODY=$(gh pr view --json body --jq '.body' 2>/dev/null || echo "")
  if [[ "$PR_BODY" =~ [Cc]loses[[:space:]]+#([0-9]+) ]]; then
    ISSUE_NUM="${BASH_REMATCH[1]}"
  fi
fi

# 3. Fallback: current branch name feat/42-slug or fix/42-slug
if [[ -z "$ISSUE_NUM" ]]; then
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
  if [[ "$BRANCH" =~ /([0-9]+)- ]]; then
    ISSUE_NUM="${BASH_REMATCH[1]}"
  fi
fi

if [[ -z "$ISSUE_NUM" ]]; then
  echo "[pm-hook] No issue number found in command or branch — skipping" >&2
fi

# ── Helpers ────────────────────────────────────────────────────────────────
get_project_item_id() {
  local content_number="$1"
  local content_type="$2"
  gh project item-list "$PROJECT_NUMBER" \
    --owner "$OWNER" --format json \
    --jq ".items[] | select(.content.number == ${content_number} and .content.type == \"${content_type}\") | .id" 2>/dev/null || echo ""
}

add_project_url() {
  local url="$1"
  gh project item-add "$PROJECT_NUMBER" \
    --owner "$OWNER" \
    --url "$url" \
    --format json \
    --jq '.id' 2>/dev/null || echo ""
}

set_in_review() {
  local item_id="$1"
  gh project item-edit \
    --project-id "$PROJECT_ID" \
    --id "$item_id" \
    --field-id "$STATUS_FIELD_ID" \
    --single-select-option-id "$IN_REVIEW_OPTION_ID" 2>/dev/null
}

# ── Add/update the PR item ─────────────────────────────────────────────────
PR_JSON=$(gh pr view --json number,url 2>/dev/null || echo "")
PR_NUM=$(printf '%s' "$PR_JSON" | jq -r '.number // ""' 2>/dev/null || echo "")
PR_URL=$(printf '%s' "$PR_JSON" | jq -r '.url // ""' 2>/dev/null || echo "")

if [[ -n "$PR_NUM" && -n "$PR_URL" ]]; then
  PR_ITEM_ID=$(get_project_item_id "$PR_NUM" "PullRequest")
  if [[ -z "$PR_ITEM_ID" ]]; then
    PR_ITEM_ID=$(add_project_url "$PR_URL")
  fi

  if [[ -n "$PR_ITEM_ID" ]] && set_in_review "$PR_ITEM_ID"; then
    echo "[pm-hook] PR #${PR_NUM} → In Review" >&2
  else
    echo "[pm-hook] WARN: Failed to add/update PR #${PR_NUM}" >&2
  fi
else
  echo "[pm-hook] WARN: Could not resolve created PR from current branch" >&2
fi

[[ -z "$ISSUE_NUM" ]] && exit 0

# ── Get or add linked issue project item ───────────────────────────────────
ITEM_ID=$(gh project item-list "$PROJECT_NUMBER" \
  --owner "$OWNER" --format json \
  --jq ".items[] | select(.content.number == $ISSUE_NUM and .content.type == \"Issue\") | .id" 2>/dev/null || echo "")

if [[ -z "$ITEM_ID" ]]; then
  ISSUE_URL="https://github.com/${REPO}/issues/${ISSUE_NUM}"
  ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" \
    --owner "$OWNER" \
    --url "$ISSUE_URL" \
    --format json \
    --jq '.id' 2>/dev/null || echo "")
fi

if [[ -z "$ITEM_ID" ]]; then
  echo "[pm-hook] Could not get/add project item for issue #${ISSUE_NUM}" >&2
  exit 0
fi

# ── Update linked issue status to "In Review" ──────────────────────────────
if set_in_review "$ITEM_ID"; then
  echo "[pm-hook] Issue #${ISSUE_NUM} → In Review" >&2
else
  echo "[pm-hook] WARN: Failed to update issue #${ISSUE_NUM} status" >&2
fi

# ── Inherit priority label from linked issue → apply to PR ────────────────
# Reads p0/p1/p2 label from issue; defaults to p1 if none found.
# Only runs when a PR and linked issue are both resolved.
if [[ -n "$PR_NUM" && -n "$ISSUE_NUM" ]]; then
  ISSUE_LABELS=$(gh issue view "$ISSUE_NUM" --repo "$REPO" --json labels \
    --jq '.labels[].name' 2>/dev/null || echo "")

  PRIORITY_LABEL=""
  while IFS= read -r lbl; do
    case "$lbl" in
      p0) PRIORITY_LABEL="p0"; break ;;
      p1) PRIORITY_LABEL="p1"; break ;;
      p2) [[ -z "$PRIORITY_LABEL" ]] && PRIORITY_LABEL="p2" ;;
    esac
  done <<< "$ISSUE_LABELS"
  [[ -z "$PRIORITY_LABEL" ]] && PRIORITY_LABEL="p1"

  # Apply label to PR if not already present
  PR_LABELS=$(gh pr view "$PR_NUM" --repo "$REPO" --json labels \
    --jq '.labels[].name' 2>/dev/null || echo "")
  if ! grep -qwE 'p0|p1|p2' <<< "$PR_LABELS"; then
    if gh pr edit "$PR_NUM" --repo "$REPO" --add-label "$PRIORITY_LABEL" 2>/dev/null; then
      echo "[pm-hook] PR #${PR_NUM} ← priority ${PRIORITY_LABEL} (from issue #${ISSUE_NUM})" >&2
    else
      echo "[pm-hook] WARN: Failed to apply priority label to PR #${PR_NUM}" >&2
    fi
  fi
fi

exit 0
