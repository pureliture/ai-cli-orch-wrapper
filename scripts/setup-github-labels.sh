#!/usr/bin/env bash
# setup-github-labels.sh
# Idempotently creates/updates GitHub issue labels for ai-cli-orch-wrapper.
# Usage: bash scripts/setup-github-labels.sh
# Requires: gh CLI authenticated with repo scope

set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null) || {
  echo "ERROR: Not a GitHub repo or gh auth failed. Run: gh auth login" >&2
  exit 1
}

echo "Setting up labels for: $REPO"

LABEL_FAILURES=0

create_or_update_label() {
  local name="$1" color="$2" description="$3"
  if gh label create "$name" --repo "$REPO" --color "$color" --description "$description" --force; then
    echo "  upserted: $name"
  else
    echo "  FAILED: $name" >&2
    LABEL_FAILURES=$((LABEL_FAILURES + 1))
  fi
}

echo ""
echo "── Type labels ──────────────────────────────"
create_or_update_label "type:epic"    "6B46C1" "Multi-issue outcome"
create_or_update_label "type:task"    "0EA5E9" "Technical implementation unit"
create_or_update_label "type:bug"     "DC2626" "Defect or regression"
create_or_update_label "type:chore"   "6B7280" "Maintenance work"

echo ""
echo "── Area labels ──────────────────────────────"
create_or_update_label "area:wrapper"   "16A34A" "packages/wrapper"
create_or_update_label "area:installer" "15803D" "packages/installer"
create_or_update_label "area:templates" "166534" "templates/"
create_or_update_label "area:ci"        "14532D" "GitHub Actions / CI"
create_or_update_label "area:ops"       "052E16" "Dev harness (this tooling)"

echo ""
echo "── Origin labels ────────────────────────────"
create_or_update_label "origin:review" "BFDBFE" "Originated from PR review comment"

echo ""
echo "── Workflow-state labels ────────────────────"
create_or_update_label "status:blocked" "E99695" "Issue is blocked by dependency or environment constraint"

echo ""
if [[ "$LABEL_FAILURES" -gt 0 ]]; then
  echo "ERROR: $LABEL_FAILURES label(s) failed to upsert. Run 'gh label list' to check." >&2
  exit 1
fi
echo "Done. Run 'gh label list' to verify."
