#!/usr/bin/env bash
# setup-github-project.sh
# Creates GitHub Projects V2 board with required fields for ai-cli-orch-wrapper PM harness.
# Handles: project creation, Status/Priority/Size/Date fields
# Manual (UI only): Views (Board/Table/Roadmap)

set -euo pipefail

OWNER="pureliture"
TITLE="ai-cli-orch-wrapper PM"
missing_required_ids=()

is_missing_id() {
  local value="${1:-}"
  [[ -z "$value" || "$value" == "null" ]]
}

require_id() {
  local label="$1"
  local value="${2:-}"

  if is_missing_id "$value"; then
    missing_required_ids+=("$label")
  fi
}

validate_required_project_ids() {
  missing_required_ids=()

  require_id "Project number (PM_PROJECT_NUMBER)" "${PROJECT_NUMBER:-}"
  require_id "Project node ID (PM_PROJECT_ID)" "${PROJECT_ID:-}"
  require_id "Status field (PM_STATUS_FIELD_ID)" "${STATUS_FIELD_ID:-}"
  require_id "Status option Backlog (PM_BACKLOG_OPTION_ID)" "${BACKLOG_ID:-}"
  require_id "Status option Ready (PM_READY_OPTION_ID)" "${READY_ID:-}"
  require_id "Status option In Progress (PM_IN_PROGRESS_OPTION_ID)" "${IN_PROGRESS_ID:-}"
  require_id "Status option In Review (PM_IN_REVIEW_OPTION_ID)" "${IN_REVIEW_ID:-}"
  require_id "Status option Done (PM_DONE_OPTION_ID)" "${DONE_ID:-}"
  require_id "Priority field (PM_PRIORITY_FIELD_ID)" "${PRIORITY_FIELD_ID:-}"
  require_id "Priority option P0 (PM_P0_OPTION_ID)" "${P0_ID:-}"
  require_id "Priority option P1 (PM_P1_OPTION_ID)" "${P1_ID:-}"
  require_id "Priority option P2 (PM_P2_OPTION_ID)" "${P2_ID:-}"

  if ((${#missing_required_ids[@]} > 0)); then
    echo "" >&2
    echo "ERROR: Incomplete canonical GitHub Project IDs; refusing to print exports or update docs/reference/project-board.md." >&2
    echo "Missing required IDs:" >&2

    local missing_id
    for missing_id in "${missing_required_ids[@]}"; do
      echo "  - ${missing_id}" >&2
    done

    echo "Canonical Status requires: field ID plus Backlog, Ready, In Progress, In Review, Done option IDs." >&2
    echo "Canonical Priority requires: field ID plus P0, P1, P2 option IDs." >&2
    exit 1
  fi
}

echo "Setting up GitHub Projects V2 for @${OWNER}..."
echo ""

# ── Create project ──────────────────────────────────────────────────────────
echo "── Creating project ──"
PROJECT_JSON=$(gh project create \
  --owner "$OWNER" \
  --title "$TITLE" \
  --format json 2>&1)

PROJECT_NUMBER=$(echo "$PROJECT_JSON" | jq -r '.number')
PROJECT_ID=$(echo "$PROJECT_JSON" | jq -r '.id')

echo "  Created: #${PROJECT_NUMBER} — ${TITLE}"
echo "  Node ID: ${PROJECT_ID}"
echo ""

# ── Status field ────────────────────────────────────────────────────────────
echo "── Creating Status field ──"
STATUS_JSON=$(gh project field-create "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --name "Status" \
  --data-type SINGLE_SELECT \
  --single-select-options "Backlog,Ready,In Progress,In Review,Done" \
  --format json 2>&1)

STATUS_FIELD_ID=$(echo "$STATUS_JSON" | jq -r '.id')
echo "  Status field ID: ${STATUS_FIELD_ID}"

# Get option IDs
STATUS_OPTIONS=$(gh project field-list "$PROJECT_NUMBER" \
  --owner "$OWNER" --format json \
  --jq '.fields[] | select(.name == "Status") | .options[]?')

BACKLOG_ID=$(echo "$STATUS_OPTIONS" | jq -r 'select(.name == "Backlog") | .id')
READY_ID=$(echo "$STATUS_OPTIONS" | jq -r 'select(.name == "Ready") | .id')
IN_PROGRESS_ID=$(echo "$STATUS_OPTIONS" | jq -r 'select(.name == "In Progress") | .id')
IN_REVIEW_ID=$(echo "$STATUS_OPTIONS" | jq -r 'select(.name == "In Review") | .id')
DONE_ID=$(echo "$STATUS_OPTIONS" | jq -r 'select(.name == "Done") | .id')
echo "  Backlog option ID: ${BACKLOG_ID}"
echo "  Ready option ID: ${READY_ID}"
echo "  In Progress option ID: ${IN_PROGRESS_ID}"
echo "  In Review option ID: ${IN_REVIEW_ID}"
echo "  Done option ID: ${DONE_ID}"
echo ""

# ── Priority field ──────────────────────────────────────────────────────────
echo "── Creating Priority field ──"
PRIORITY_FIELD_ID=$(gh project field-list "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --format json \
  --jq '.fields[] | select(.name == "Priority") | .id' \
  2>/dev/null | head -n 1)

if [[ -z "$PRIORITY_FIELD_ID" ]]; then
  PRIORITY_JSON=$(gh project field-create "$PROJECT_NUMBER" \
    --owner "$OWNER" \
    --name "Priority" \
    --data-type SINGLE_SELECT \
    --single-select-options "P0,P1,P2" \
    --format json)

  PRIORITY_FIELD_ID=$(echo "$PRIORITY_JSON" | jq -r '.id')
fi
echo "  Priority field ID: ${PRIORITY_FIELD_ID}"

PRIORITY_OPTIONS=$(gh project field-list "$PROJECT_NUMBER" \
  --owner "$OWNER" --format json \
  --jq '.fields[] | select(.name == "Priority") | .options[]?')

P0_ID=$(echo "$PRIORITY_OPTIONS" | jq -r 'select(.name == "P0") | .id')
P1_ID=$(echo "$PRIORITY_OPTIONS" | jq -r 'select(.name == "P1") | .id')
P2_ID=$(echo "$PRIORITY_OPTIONS" | jq -r 'select(.name == "P2") | .id')
echo "  P0 option ID: ${P0_ID}"
echo "  P1 option ID: ${P1_ID}"
echo "  P2 option ID: ${P2_ID}"

validate_required_project_ids

# ── Size field ──────────────────────────────────────────────────────────────
echo "── Creating Size field ──"
gh project field-create "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --name "Size" \
  --data-type SINGLE_SELECT \
  --single-select-options "S,M,L" \
  --format json > /dev/null
echo "  Size field created (S/M/L)"

# ── Target date field ────────────────────────────────────────────────────────
echo "── Creating Target date field ──"
gh project field-create "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --name "Target date" \
  --data-type DATE \
  --format json > /dev/null
echo "  Target date field created"
echo ""

# ── Link repo to project ─────────────────────────────────────────────────────
echo "── Linking repository ──"
gh project link "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --repo "pureliture/ai-cli-orch-wrapper" 2>/dev/null \
  && echo "  Linked: pureliture/ai-cli-orch-wrapper" \
  || echo "  (link skipped — may require manual step)"
echo ""

# ── Output env vars ──────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "✓ Project setup complete"
echo ""
echo "Add to ~/.zshrc or ~/.bashrc:"
echo ""
echo "  export PM_PROJECT_NUMBER=\"${PROJECT_NUMBER}\""
echo "  export PM_PROJECT_ID=\"${PROJECT_ID}\""
echo "  export PM_STATUS_FIELD_ID=\"${STATUS_FIELD_ID}\""
echo "  export PM_BACKLOG_OPTION_ID=\"${BACKLOG_ID}\""
echo "  export PM_READY_OPTION_ID=\"${READY_ID}\""
echo "  export PM_IN_PROGRESS_OPTION_ID=\"${IN_PROGRESS_ID}\""
echo "  export PM_IN_REVIEW_OPTION_ID=\"${IN_REVIEW_ID}\""
echo "  export PM_DONE_OPTION_ID=\"${DONE_ID}\""
echo "  export PM_PRIORITY_FIELD_ID=\"${PRIORITY_FIELD_ID}\""
echo "  export PM_P0_OPTION_ID=\"${P0_ID}\""
echo "  export PM_P1_OPTION_ID=\"${P1_ID}\""
echo "  export PM_P2_OPTION_ID=\"${P2_ID}\""
echo ""
echo "── Manual steps remaining (GitHub UI) ──────────────────"
echo "  1. Create views:"
echo "     - Board view: 'Kanban' (group: Status)"
echo "     - Table view: 'Triage' (filter: missing labels or Project fields)"
echo "     - Table view: 'Roadmap' (group: type:epic)"
echo "     https://github.com/orgs/${OWNER}/projects/${PROJECT_NUMBER}"
echo "═══════════════════════════════════════════════════════"

# ── Write IDs to docs/reference/project-board.md ───────────────────────────
if [[ -f docs/reference/project-board.md ]]; then
  sed -i.bak \
    -e "s|PM_PROJECT_NUMBER=\"\"|PM_PROJECT_NUMBER=\"${PROJECT_NUMBER}\"|" \
    -e "s|PM_PROJECT_ID=\"\"|PM_PROJECT_ID=\"${PROJECT_ID}\"|" \
    -e "s|PM_STATUS_FIELD_ID=\"\"|PM_STATUS_FIELD_ID=\"${STATUS_FIELD_ID}\"|" \
    -e "s|PM_BACKLOG_OPTION_ID=\"\"|PM_BACKLOG_OPTION_ID=\"${BACKLOG_ID}\"|" \
    -e "s|PM_READY_OPTION_ID=\"\"|PM_READY_OPTION_ID=\"${READY_ID}\"|" \
    -e "s|PM_IN_PROGRESS_OPTION_ID=\"\"|PM_IN_PROGRESS_OPTION_ID=\"${IN_PROGRESS_ID}\"|" \
    -e "s|PM_IN_REVIEW_OPTION_ID=\"\"|PM_IN_REVIEW_OPTION_ID=\"${IN_REVIEW_ID}\"|" \
    -e "s|PM_DONE_OPTION_ID=\"\"|PM_DONE_OPTION_ID=\"${DONE_ID}\"|" \
    -e "s|PM_PRIORITY_FIELD_ID=\"\"|PM_PRIORITY_FIELD_ID=\"${PRIORITY_FIELD_ID}\"|" \
    -e "s|PM_P0_OPTION_ID=\"\"|PM_P0_OPTION_ID=\"${P0_ID}\"|" \
    -e "s|PM_P1_OPTION_ID=\"\"|PM_P1_OPTION_ID=\"${P1_ID}\"|" \
    -e "s|PM_P2_OPTION_ID=\"\"|PM_P2_OPTION_ID=\"${P2_ID}\"|" \
    docs/reference/project-board.md && rm -f docs/reference/project-board.md.bak
  echo ""
  echo "  docs/reference/project-board.md updated with IDs"
fi
