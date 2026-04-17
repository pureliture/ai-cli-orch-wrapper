## 1. Provider and Contract Documentation

- [x] 1.1 Remove Copilot provider references and mappings from `cmd/aco/main.go`.
- [x] 1.2 Update `docs/contract/blocking-execution-contract.md` to include a full reference snippet demonstrating `pgid` (process group ID) calculation and usage.
- [x] 1.3 Update `CLAUDE.md` or related developer docs to ensure they reflect the removal of the Copilot provider mapping.

## 2. CI and PM Automation Robustness

- [x] 2.1 Modify `.github/workflows/ci.yml` to remove the `|| true` masking from the `aco run --help` smoke test step, enforcing a strict exit code 0.
- [x] 2.2 Enhance `scripts/pm-hook.sh` linked issue extraction to parse the current branch name (e.g., `feat/24-slug`) for the issue number as a fallback when the PR body `Closes #N` parsing fails.

## 3. Label Taxonomy and Harness Correctness

- [x] 3.1 Update `scripts/setup-github-labels.sh` to explicitly add the creation of the `type:story` label.
- [x] 3.2 Update `openspec/changes/pm-harness/tasks.md` to ensure its documented label counts and taxonomy match the actual implementation in the repository.
