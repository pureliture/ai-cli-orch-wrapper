# GitHub Projects V2 — Project Board Reference

## Setup Status

- [x] Project created: #3 "AI-Harness-Construct"
- [x] Status field: Backlog / Ready / In Progress / In Review / Done
- [x] Priority field: P0 / P1 / P2
- [x] Size field: S / M / L
- [x] Target date field
- [x] Sprint (Iteration) field
- [x] Views (Active Sprint, Triage, Roadmap) configured in GitHub UI

## Setup Instructions (remaining)

## Fields

| Field | Type | Options |
|-------|------|---------|
| Status | Single select | Backlog, Ready, In Progress, In Review, Done |
| Priority | Single select | P0, P1, P2 |
| Size | Single select | S, M, L |
| Sprint | Iteration | 2-week cycles |
| Target date | Date | — |
| Parent issue | ProjectV2Field | (GitHub Native) Source of truth for Epic |
| epic | ProjectV2Field | **DEPRECATED** — use Parent issue instead |

## Views

| View | Type | Filter | Group by |
|------|------|--------|----------|
| Active Sprint | Board | `sprint:@current` | Status |
| Triage | Table | `No:label` | (none) |
| Roadmap | Table | (none) | (none) |

## IDs (fill in after setup)

Run the following after Projects V2 is configured:

```bash
bash scripts/setup-project-ids.sh
```

Or manually:

```bash
# Get project number and node ID
gh project list --owner pureliture

# Get field IDs
gh project field-list <PROJECT_NUMBER> --owner pureliture --format json

# Copy the values below:
PM_PROJECT_NUMBER=""   # e.g., 1
PM_PROJECT_ID=""       # node ID (GUID) — from gh project view N --json id -q .id
PM_STATUS_FIELD_ID=""  # Status field node ID
PM_IN_REVIEW_OPTION_ID=""  # "In Review" option node ID
```

Set these in your shell rc (`.zshrc` / `.bashrc`):

```bash
export PM_PROJECT_NUMBER="3"
export PM_PROJECT_ID="PVT_kwHOA6302M4BT5fA"
export PM_STATUS_FIELD_ID="PVTSSF_lAHOA6302M4BT5fAzhBFN48"
export PM_IN_REVIEW_OPTION_ID="961ca78f"
export PM_IN_PROGRESS_OPTION_ID="68368c4f"
export PM_DONE_OPTION_ID="b36b62fa"
export PM_PRIORITY_FIELD_ID="PVTSSF_lAHOA6302M4BT5fAzhBFN_U"
export PM_P0_OPTION_ID="65dd5d04"
export PM_P1_OPTION_ID="ed47fdcf"
export PM_P2_OPTION_ID="6eb1a525"
```

## Branch Protection Rules (after CI runs once on main)

GitHub UI → Settings → Branches → Add rule → `main`:

- [x] Require status checks to pass: `lint`, `typecheck`, `test`, `smoke`
- [x] Require branches to be up to date before merging
- [x] Require a pull request before merging
- [x] Require squash merge (Allowed merge methods: Squash only)
