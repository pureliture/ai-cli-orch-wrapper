# GitHub Projects V2 — PM Board Configuration

## Setup Status

- [x] Project created: #3 "AI-Harness-Construct"
- [x] Status field: Backlog / Ready / In Progress / In Review / Done
- [x] Priority field: P0 / P1 / P2
- [x] Size field: S / M / L
- [x] Target date field
- [x] Sprint (Iteration) field
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

## Command Structure (V3+)

Three command axes for PM workflow automation:

| Axis | Commands | Purpose |
|------|----------|---------|
| `/opsx:*` | `opsx:propose`, `opsx:apply`, `opsx:archive` | OpenSpec change lifecycle |
| `/gh-*` | `gh-issue`, `gh-start`, `gh-pr`, `gh-followup` | GitHub issue/PR operations |
| `/octo:*` | `octo:multi`, `octo:review`, `octo:tdd`, … | Multi-AI orchestration |

### `/gh-*` Command Reference

| Command | What it does |
|---------|-------------|
| `/gh-issue` | Create issue + `type:*` + `sprint:v3` labels + Project #3 Backlog |
| `/gh-start #N` | In Progress transition + `status:in-progress` label + branch creation |
| `/gh-pr` | PR create + `Closes #N` + CI checklist + Epic reminder |
| `/gh-followup` | Post-review issue + `origin:review` + `type:*` + Project #3 Backlog |
| `/gh-issue:multi` | `/gh-issue` with multi-AI scope validation |
| `/gh-start:multi` | `/gh-start` with multi-AI readiness check |
| `/gh-pr:multi` | `/gh-pr` with multi-AI PR readiness validation |
| `/gh-followup:multi` | `/gh-followup` with multi-AI content validation |

## Issue Authoring Rules

Use one sprint epic plus child issues for sprint planning.

### Title Convention (V3+)

**From V3 onward**, issue titles use conventional commit format. The `[Sprint V*][Type]` prefix is deprecated.

```text
feat: add gh-pm-workflow-commands
fix: handle null session in wrapper
chore: update typescript deps
bug: codex auth failure classification unreachable
spike: investigate gemini streaming API
```

Rules:
- Use `type: description` format (no sprint or type prefix in title).
- Type is conveyed via the `type:*` label, not the title.
- Sprint is conveyed via the `sprint:v*` label, not the title.
- Keep priority and area out of titles; use `p0`/`p1`/`p2` and `area:*` labels.
- Child issues must include `Parent epic: #N` as the first line of the body.
- Sprint epics must maintain a `Child Issues` checklist in the body.

**Legacy format** (pre-V3, for reference only):
```text
[Sprint V3][Epic] PM 하네스 구축 — GitHub Projects + Actions + Claude Code
[Sprint V3][Task] GitHub Actions CI 파이프라인 구현
```

PR title format:

```text
feat(pm-harness): implement GitHub Projects + Actions + Claude Code PM harness
```

PR rules:

- Use conventional commit style: `type(scope): description`.
- Do not add `[Sprint]`, `[Task]`, or `[Epic]` prefixes to PR titles.
- Include `Closes #N` in the PR body.
- Add sprint-scoped PRs to the PM project and set PR `Status` to `In Review`.
- Keep `Priority`, `Size`, and `Sprint` on issues by default; do not mirror them onto PR items unless needed.

### `origin:review` Label Usage

Use the `origin:review` label to track issues created from PR review feedback:

- Apply `origin:review` + `type:task` for improvements or features surfaced in review.
- Apply `origin:review` + `type:chore` for refactoring tasks surfaced in review.
- Apply `origin:review` + `type:bug` for defects found during review.
- Always use `/gh-followup` command to create these — it handles the body format and label assignment automatically.
- The issue body must begin with `From: #<PR> review comment` and end with `See also: #<PR>`.

Automation rule:

```text
gh pr create → PR item Status = In Review
             → linked issue #N Status = In Review
```

Generate standardized titles and bodies with:

```bash
python3 .claude/skills/github-jira-ops/scripts/make_issue_body.py \
  --type task \
  --sprint V3 \
  --title "GitHub Actions CI 파이프라인 구현" \
  --summary "Implement the PM harness CI workflow." \
  --parent "#22" \
  --acceptance "[ ] lint/typecheck/test/smoke jobs are split" \
  --acceptance "[ ] go test ./... passes" \
  --format all
```

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
```

## Branch Protection Rules (after CI runs once on main)

GitHub UI → Settings → Branches → Add rule → `main`:

- [x] Require status checks to pass: `lint`, `typecheck`, `test`, `smoke`
- [x] Require branches to be up to date before merging
- [x] Require a pull request before merging
- [x] Require squash merge (Allowed merge methods: Squash only)
