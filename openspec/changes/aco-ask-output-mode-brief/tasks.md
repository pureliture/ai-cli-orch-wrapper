## 1. Output Bounding Helper

- [x] 1.1 Implement bounding logic to truncate output strings to a specified limit (e.g., 1000 characters).
- [x] 1.2 Ensure a truncation indicator (`\n... (truncated)`) is appended if the output exceeds the boundary.

## 2. Session Brief UI Update

- [x] 2.1 Update `renderSessionBrief` in `packages/wrapper/src/commands/ask.ts` to include an `Output Preview` section.
- [x] 2.2 Append the bounded preview of `outputLog` inside `renderSessionBrief`.

## 3. Run Brief UI Update

- [x] 3.1 Update `renderRunBrief` in `packages/wrapper/src/commands/ask.ts` to include bounded previews for each session.
- [x] 3.2 Ensure the previews are correctly formatted within the overall run brief output.

## 4. Tests & Validation

- [x] 4.1 Validate changes with TypeScript and test suite (`npm run typecheck`, `npm test`).
- [x] 4.2 Run a manual smoke test with `aco ask --output-mode brief` to visually confirm the summary extraction and truncation indicator.