## Context

The `aco ask` MVP introduced different output modes. Specifically, `--output-mode brief` is designed to provide a high-level summary of the provider's execution, minimizing terminal scroll and token usage for orchestration tools. However, currently, the `brief` mode only outputs the session status, the path to the output log, and error messages (if any). It omits the actual text/content of the provider's response, forcing users to manually read the `outputLog` or run `aco result` to understand the result.

## Goals / Non-Goals

**Goals:**
- Include a bounded summary (first N characters) of the provider's output log in the `brief` output mode so users can get the gist of the response without running an extra command.
- Apply this enhancement to both the overall run brief (`renderRunBrief`) and the session-specific brief (`renderSessionBrief`).
- Maintain backward compatibility and not disrupt existing tests for `aco ask`.

**Non-Goals:**
- Summarizing the output using another AI model (this introduces cost and latency).
- Modifying the behavior of the `full` output mode.

## Decisions

1. **Extracting Bounded Output Preview:**
   - We will implement a simple substring extraction mechanism (e.g., `output.substring(0, 1000)`) from the `outputLog`. If the output exceeds the limit, we will append an omission indicator (e.g., `\n... (truncated)`).
   - *Alternative Considered*: Running a local heuristic or NLP summarization. *Rationale for Rejection*: Too complex, prone to latency, and breaks the "lightweight" constraint of the wrapper. A simple substring is predictable and fast.

2. **Integration points:**
   - In `renderSessionBrief`, we will use the already available `outputLog` content, extracting the bounded text and appending it under an `Output Preview` section.
   - In `renderRunBrief`, we will map over each session's `outputLog` and display the preview.
   - The boundary limit will be hardcoded (e.g., 1000 characters) for simplicity in this MVP iteration.

## Risks / Trade-offs

- [Risk] Truncation might cut off important information like JSON structure or final conclusions located at the end of the log. -> Mitigation: Provide clear instructions in the brief that the output is truncated and point the user to the `outputLog` path for the complete output.