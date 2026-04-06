## 1. Compatibility Scope

- [ ] 1.1 Define the narrow `ccg-workflow` compatibility contract for spawn, stream, PID, cancel, and exit semantics
- [ ] 1.2 Explicitly exclude Windows-only, SSE/web UI, browser-launch, and packaging concerns from the contract

## 2. Gap Documentation

- [ ] 2.1 Record the local wrapper behaviors that already satisfy the narrow contract baseline
- [ ] 2.2 Record the remaining gaps between the local wrapper and the documented compatibility contract

## 3. Validation

- [ ] 3.1 Validate the OpenSpec change artifacts with `openspec validate`
- [ ] 3.2 Use this change as the baseline for any future implementation or regression tests
