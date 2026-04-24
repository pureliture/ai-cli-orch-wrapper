#!/usr/bin/env bash
# setup-project-ids.sh
# After GitHub Projects V2 is set up, run this to get the IDs needed for
# canonical GitHub Kanban commands and hooks.
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

FIELDS_JSON=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json 2>/dev/null)

field_id() {
  local field_name="$1"
  printf '%s' "$FIELDS_JSON" |
    jq -r --arg name "$field_name" '.fields[] | select(.name == $name) | .id' |
    head -n 1
}

option_id() {
  local field_name="$1"
  local option_name="$2"
  printf '%s' "$FIELDS_JSON" |
    jq -r --arg field "$field_name" --arg option "$option_name" \
      '.fields[] | select(.name == $field) | .options[]? | select(.name == $option) | .id' |
    head -n 1
}

STATUS_FIELD_ID=$(field_id "Status")
BACKLOG_OPTION_ID=$(option_id "Status" "Backlog")
READY_OPTION_ID=$(option_id "Status" "Ready")
IN_PROGRESS_OPTION_ID=$(option_id "Status" "In Progress")
IN_REVIEW_OPTION_ID=$(option_id "Status" "In Review")
DONE_OPTION_ID=$(option_id "Status" "Done")
PRIORITY_FIELD_ID=$(field_id "Priority")
P0_OPTION_ID=$(option_id "Priority" "P0")
P1_OPTION_ID=$(option_id "Priority" "P1")
P2_OPTION_ID=$(option_id "Priority" "P2")

echo "── Fields ──"
printf '%s' "$FIELDS_JSON" |
  jq -r '.fields[] | "  \(.name)  [\(.id)]  type:\(.type)"'

echo ""
echo "── Status field options ──"
printf '%s' "$FIELDS_JSON" |
  jq -r '.fields[] | select(.name == "Status") | .options[] | "  \(.name)  [\(.id)]"'

echo ""
echo "── Priority field options ──"
printf '%s' "$FIELDS_JSON" |
  jq -r '.fields[] | select(.name == "Priority") | .options[] | "  \(.name)  [\(.id)]"'

if [[ -z "$STATUS_FIELD_ID" || -z "$BACKLOG_OPTION_ID" || -z "$READY_OPTION_ID" ||
      -z "$IN_PROGRESS_OPTION_ID" || -z "$IN_REVIEW_OPTION_ID" || -z "$DONE_OPTION_ID" ||
      -z "$PRIORITY_FIELD_ID" || -z "$P0_OPTION_ID" || -z "$P1_OPTION_ID" || -z "$P2_OPTION_ID" ]]; then
  echo ""
  echo "WARN: Missing one or more canonical Status/Priority fields or options." >&2
  echo "      Compare the project setup with docs/reference/project-board.md." >&2
fi

echo ""
echo "── Add to your shell rc (~/.zshrc or ~/.bashrc) ──"
cat << EOF
export PM_PROJECT_NUMBER="${PROJECT_NUMBER}"
export PM_PROJECT_ID="${PROJECT_ID}"
export PM_STATUS_FIELD_ID="${STATUS_FIELD_ID}"
export PM_BACKLOG_OPTION_ID="${BACKLOG_OPTION_ID}"
export PM_READY_OPTION_ID="${READY_OPTION_ID}"
export PM_IN_PROGRESS_OPTION_ID="${IN_PROGRESS_OPTION_ID}"
export PM_IN_REVIEW_OPTION_ID="${IN_REVIEW_OPTION_ID}"
export PM_DONE_OPTION_ID="${DONE_OPTION_ID}"
export PM_PRIORITY_FIELD_ID="${PRIORITY_FIELD_ID}"
export PM_P0_OPTION_ID="${P0_OPTION_ID}"
export PM_P1_OPTION_ID="${P1_OPTION_ID}"
export PM_P2_OPTION_ID="${P2_OPTION_ID}"
EOF
