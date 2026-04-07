# GitHub Projects V2 — PM Board Configuration

## Setup Status

- [x] Project created: #3 "ai-cli-orch-wrapper PM"
- [x] Status field: Backlog / Ready / In Progress / In Review / Done
- [x] Priority field: P0 / P1 / P2
- [x] Size field: S / M / L
- [x] Target date field
- [ ] Sprint (Iteration) field — add manually in GitHub UI
- [ ] Views (Active Sprint, Triage, Roadmap) — add manually in GitHub UI

## Setup Instructions (remaining)

## Fields

| Field | Type | Options |
|-------|------|---------|
| Status | Single select | Backlog, Ready, In Progress, In Review, Done |
| Priority | Single select | P0, P1, P2 |
| Size | Single select | S, M, L |
| Sprint | Iteration | 2-week cycles |
| Target date | Date | — |

## Views

| View | Type | Filter | Group by |
|------|------|--------|----------|
| Active Sprint | Board | Sprint: @current | Status |
| Triage | Table | No iteration OR no labels | — |
| Roadmap | Table | — | type:epic label |

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
```

## Branch Protection Rules (after CI runs once on main)

GitHub UI → Settings → Branches → Add rule → `main`:

- [x] Require status checks to pass: `lint`, `typecheck`, `test`, `smoke`
- [x] Require branches to be up to date before merging
- [x] Require a pull request before merging
- [x] Require squash merge (Allowed merge methods: Squash only)
