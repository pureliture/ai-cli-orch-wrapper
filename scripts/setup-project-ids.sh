#!/usr/bin/env bash
# setup-project-ids.sh
# After GitHub Projects V2 is set up, run this to get the IDs needed for pm-hook.sh.
# Usage: bash scripts/setup-project-ids.sh

set -euo pipefail

OWNER="pureliture"

echo "Fetching GitHub Projects V2 IDs for @${OWNER}..."
echo ""

# List projects
echo "── Projects ──"
gh project list --owner "$OWNER" --format json \
  --jq '.projects[] | "  #\(.number)  \(.title)  [\(.id)]"' 2>/dev/null || {
  echo "  No projects found or gh auth missing project scope."
  exit 1
}

echo ""
read -r -p "Enter project number: " PROJECT_NUMBER

PROJECT_ID=$(gh project view "$PROJECT_NUMBER" \
  --owner "$OWNER" --format json --jq '.id' 2>/dev/null)

echo ""
echo "Project ID (node): $PROJECT_ID"
echo ""

echo "── Fields ──"
gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json \
  --jq '.fields[] | "  \(.name)  [\(.id)]  type:\(.type)"' 2>/dev/null

echo ""
echo "── Status field options ──"
gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json \
  --jq '.fields[] | select(.name == "Status") | .options[] | "  \(.name)  [\(.id)]"' 2>/dev/null

echo ""
echo "── Add to your shell rc (~/.zshrc or ~/.bashrc) ──"
cat << EOF
export PM_PROJECT_NUMBER="${PROJECT_NUMBER}"
export PM_PROJECT_ID="${PROJECT_ID}"
export PM_STATUS_FIELD_ID="<Status field ID from above>"
export PM_IN_REVIEW_OPTION_ID="<In Review option ID from above>"
EOF
