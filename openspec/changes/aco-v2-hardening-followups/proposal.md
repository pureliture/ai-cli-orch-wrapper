## Why

Following the code review of PR #23 (PM harness / aco v2 integrity), several unresolved comments and follow-up tasks were identified for the v2 hardening baseline. Addressing these items in Sprint V3.1 is critical to ensure the `aco` runtime's stability, the accuracy of our PM automation hooks, and the correctness of our development and CI/CD documentation.

## What Changes

- Decide on and implement the policy for maintaining or removing the Copilot provider, ensuring documentation matches the codebase reality.
- Remove masking (`|| true`) from the CI smoke test job for `aco run --help` to strictly enforce expected exit codes and outputs.
- Refine the PM hook's linked issue parsing logic to accurately handle `gh pr create --fill` scenarios by explicitly tracking branch names or accurately parsing the generated PR body.
- Enhance the blocking execution contract documentation by including the `pgid` calculation step in the reference snippet.
- Correct the label taxonomy and counts in the `openspec/changes/pm-harness/tasks.md` file to match the actual project setup.
- Add the creation of the `type:story` label to `scripts/setup-github-labels.sh` as it is a documented first-class issue type.

## Capabilities

### New Capabilities
None. This change focuses on hardening existing implementations and documentation.

### Modified Capabilities
- `aco-v2-spec`: Updates to provider support policies (Copilot) and refinements to the documented blocking execution contract (specifically `pgid` calculation).

## Impact

- `cmd/aco/main.go`: Provider registry mapping updates.
- `.github/workflows/ci.yml`: Smoke test assertion strictness.
- `scripts/pm-hook.sh`: PR body/branch parsing for linked issues.
- `docs/contract/blocking-execution-contract.md`: Code snippet updates.
- `scripts/setup-github-labels.sh`: Addition of `type:story` label.
- `openspec/changes/pm-harness/tasks.md`: Documentation updates.
