#!/usr/bin/env bash
# pm-hook.sh — Claude Code PostToolUse hook
# Detects 'gh pr create' and moves the linked issue to "In Review" in GitHub Projects V2.
#
# Payload (stdin JSON):
#   { "tool_name": "Bash", "tool_input": { "command": "..." }, ... }
#
# Config (set in shell rc or .claude/settings.local.json env after Projects setup):
#   PM_PROJECT_NUMBER   — Project number shown in URL (e.g., 1)
#   PM_PROJECT_ID       — Projects V2 node ID (GUID) — from 'gh project view N --json id -q .id'
#   PM_STATUS_FIELD_ID  — Status field node ID — from setup-project-ids.sh
#   PM_IN_REVIEW_OPTION_ID — "In Review" option node ID
#
# Run 'bash scripts/setup-project-ids.sh' after Projects V2 setup to get IDs.

set -uo pipefail

# ── Read stdin payload once ────────────────────────────────────────────────
PAYLOAD=$(cat)

# ── Parse JSON in one pass ─────────────────────────────────────────────────
read -r TOOL_NAME COMMAND <<EOF
$(printf '%s' "$PAYLOAD" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get("tool_input") or {}
    if not isinstance(ti, dict): ti = {}
    print(d.get("tool_name", ""))
    print(ti.get("command", ""))
except Exception:
    print("")
    print("")
' 2>/dev/null || printf '\n\n')
EOF

# ── Fast path: exit immediately if not Bash or not gh pr create ───────────
[[ "$TOOL_NAME" != "Bash" ]] && exit 0
[[ "$COMMAND" =~ (^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+create([[:space:]]|$) ]] || exit 0

# ── Verify we're in the right repo ─────────────────────────────────────────
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
[[ "$REMOTE" != *"pureliture/ai-cli-orch-wrapper"* ]] && exit 0

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

# From PR body "Closes #N" / "closes #N"
if [[ "$COMMAND" =~ [Cc]loses[[:space:]]#([0-9]+) ]]; then
  ISSUE_NUM="${BASH_REMATCH[1]}"
fi

# Fallback: current branch name feat/42-slug or fix/42-slug
if [[ -z "$ISSUE_NUM" ]]; then
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
  if [[ "$BRANCH" =~ /([0-9]+)- ]]; then
    ISSUE_NUM="${BASH_REMATCH[1]}"
  fi
fi

if [[ -z "$ISSUE_NUM" ]]; then
  echo "[pm-hook] No issue number found in command or branch — skipping" >&2
  exit 0
fi

REPO="pureliture/ai-cli-orch-wrapper"

# ── Get or add project item ────────────────────────────────────────────────
ITEM_ID=$(gh project item-list "$PROJECT_NUMBER" \
  --owner pureliture --format json \
  --jq ".items[] | select(.content.number == $ISSUE_NUM) | .id" 2>/dev/null || echo "")

if [[ -z "$ITEM_ID" ]]; then
  ISSUE_URL="https://github.com/${REPO}/issues/${ISSUE_NUM}"
  ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" \
    --owner pureliture \
    --url "$ISSUE_URL" \
    --format json \
    --jq '.id' 2>/dev/null || echo "")
fi

if [[ -z "$ITEM_ID" ]]; then
  echo "[pm-hook] Could not get/add project item for issue #${ISSUE_NUM}" >&2
  exit 0
fi

# ── Update status to "In Review" (PROJECT_ID = node GUID) ─────────────────
if gh project item-edit \
  --project-id "$PROJECT_ID" \
  --id "$ITEM_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$IN_REVIEW_OPTION_ID" 2>/dev/null; then
  echo "[pm-hook] Issue #${ISSUE_NUM} → In Review" >&2
else
  echo "[pm-hook] WARN: Failed to update issue #${ISSUE_NUM} status" >&2
fi

exit 0
