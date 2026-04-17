Closes #24

## What

Remove the Copilot provider implementation from both the Go runtime and Node.js wrapper to align the architectural surface with our official documentation. Remove the `|| true` masking from the `aco run --help` smoke test in `.github/workflows/ci.yml` to strictly enforce binary execution validation. Enhance `scripts/pm-hook.sh` to extract linked issue numbers from the PR body or the current branch name, ensuring reliability when `gh pr create --fill` is used. Provide a fully self-contained reference snippet in `docs/contract/blocking-execution-contract.md` detailing how to use `Setpgid: true` for process group management. Add the `type:story` label to `scripts/setup-github-labels.sh` and update the label count in the `pm-harness/tasks.md` OpenSpec tracking document.

## Why

During the Sprint V3 hardening (PR #23), several technical and process-level decisions were deferred to Sprint V3.1. This PR resolves these pending items to simplify the provider runtime, guarantee the smoke test properly catches basic execution failures, and improve the resilience of our PM automation hooks against different PR creation methods. Supplying a complete snippet for process group management also clarifies the Go/Node.js contract boundary for future implementers.

## Changes

- Remove `internal/provider/copilot.go` and `packages/wrapper/src/providers/copilot.ts`
- Remove `CopilotProvider` from the Node.js provider registry
- Update `CLAUDE.md` to reflect the removal of the Copilot provider
- Update `docs/contract/blocking-execution-contract.md` with a complete `pgid` usage snippet
- Remove `|| true` masking from `aco run --help` in `.github/workflows/ci.yml`
- Update `scripts/pm-hook.sh` to parse PR body and branch name for issue numbers
- Add `type:story` label to `scripts/setup-github-labels.sh`
- Update the label count to 18 in `openspec/changes/pm-harness/tasks.md`
- Add OpenSpec artifacts for `aco-v2-hardening-followups`

## Checklist
- [ ] npm test passes
- [ ] manual smoke test
- [ ] docs updated if needed

> Note: manually check parent epic #22 checkbox after merge