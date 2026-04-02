---
status: complete
phase: 07-review-status-setup
source:
  - .planning/phases/07-review-status-setup/07-01-SUMMARY.md
  - .planning/phases/07-review-status-setup/07-02-SUMMARY.md
  - .planning/phases/07-review-status-setup/07-03-SUMMARY.md
started: "2026-04-02T01:48:00.000Z"
updated: "2026-04-02T01:59:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Test suite passes
expected: Running `bash .claude/aco/tests/test-review-commands.sh` prints "Results: 11 passed, 0 failed" and exits 0.
result: pass

### 2. Routing config in .wrapper.json
expected: `jq '.routing' .wrapper.json` outputs `{ "review": "gemini", "adversarial": "copilot" }`.
result: pass

### 3. Reviewer prompts have correct structure
expected: Both reviewer.md files contain Critical, Major, Minor, Suggestions headings.
result: pass

### 4. /gemini:review command — diff dispatch (REV-01)
expected: Contains git diff HEAD, git diff HEAD~1, No changes detected, aco_check_adapter "gemini", aco_adapter_invoke "gemini".
result: pass

### 5. /copilot:review command — diff dispatch (REV-01)
expected: Same fallback chain for copilot adapter.
result: pass

### 6. /gemini:review — file arg guard (REV-02)
expected: Both review.md files print "Error: file not found: $FILE_ARG" to stderr and exit 1 on missing file.
result: pass

### 7. /gemini:status and /copilot:status — adapter availability
expected: Both use aco_adapter_available + aco_adapter_version, no direct binary calls.
result: pass

### 8. /gemini:setup and /copilot:setup — install + auth instructions
expected: gemini auth login in gemini/setup.md, gh auth login in copilot/setup.md, npm install -g lines present.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
