## Context

During the code review of PR #23, which established the PM harness and the aco v2 hardening baseline, several items were deferred to a Sprint V3.1 follow-up. These involve architectural and process-level decisions, specifically around supported AI providers, CI robustness, PM automation reliability, and clear technical contracts between the Go and Node.js components.

## Goals / Non-Goals

**Goals:**
- Resolve all pending P1 and P2 review comments from PR #23.
- Simplify the `aco` runtime surface area by aligning supported providers with official documentation.
- Harden the CI pipeline by ensuring the smoke test strictly verifies binary execution.
- Improve the reliability of the PM automation hook (`pm-hook.sh`), particularly when PRs are created using `gh pr create --fill`.
- Provide a complete, self-contained reference snippet for the blocking execution contract.

**Non-Goals:**
- Introducing new features or new AI providers to the `aco` runtime.
- A complete redesign of the PM board or GitHub Projects integration beyond what was established in PR #23.

## Decisions

1. **Copilot Provider Policy**: 
   - *Decision*: Remove the Copilot provider mapping from `cmd/aco/main.go` for the v2 baseline. 
   - *Rationale*: The Copilot provider is currently not fully documented or officially supported in the same capacity as Gemini or Claude. Removing it simplifies the v2 architectural surface and ensures absolute parity between the codebase and the documentation (`CLAUDE.md`, `go-node-boundary.md`). It can be reintroduced later as a formal feature.

2. **CI Smoke Test Enforcement**:
   - *Decision*: Remove the `|| true` masking from `aco run --help` in `.github/workflows/ci.yml`.
   - *Rationale*: The smoke job must fail if the packaged binary cannot execute basic commands. Masking the failure defeats the purpose of the smoke test.

3. **PM Hook Linked Issue Parsing**:
   - *Decision*: Enhance `scripts/pm-hook.sh` to extract the linked issue number from the current Git branch name if parsing the PR body fails.
   - *Rationale*: When developers use `gh pr create --fill`, the generated PR body might not contain explicit `Closes #N` keywords if the commit messages don't have them. Falling back to parsing the branch name (which follows the `<type>/<issue-number>-<slug>` convention, e.g., `feat/24-...`) ensures the hook reliably identifies the parent issue.

4. **Blocking Execution Contract Snippet**:
   - *Decision*: Update `docs/contract/blocking-execution-contract.md` to explicitly include the logic for obtaining and using the process group ID (`pgid`).
   - *Rationale*: Providing a fully self-contained code snippet prevents implementers from having to guess or reverse-engineer how to manage process groups for cleanup, fulfilling a key requirement of the contract.

## Risks / Trade-offs

- **Risk:** Removing the Copilot provider might break local workflows for developers who were implicitly relying on it.
  - **Mitigation:** Communicate the change clearly in the PR description and ensure the documentation reflects the supported list (Gemini, Claude, etc.).
- **Risk:** Parsing branch names in `pm-hook.sh` could fail if developers manually create branches that don't follow the convention.
  - **Mitigation:** Use a robust regular expression (`^[a-z]+?/([0-9]+)-`) and only use this as a fallback when body parsing yields no results.