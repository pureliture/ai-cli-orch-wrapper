---
description: "Pull Request readiness validation with multi-AI"
---

# Multi-AI GH PR

This is the multi-provider variant of the `/gh-pr` command.

## Instructions

1. Check if the `/octo:multi` skill is available in the current environment.

2. If `/octo:multi` is NOT available:
   - Display this message to the user: 'Please install octo skills first. Run: /octo:setup'
   - Do NOT proceed further.

3. If `/octo:multi` IS available:
   - Use it to perform a PR readiness validation.
   - The validation should check:
     - PR Title follows naming conventions.
     - PR scope matches the linked issue.
     - PR checklist items (if any) are complete and accurate.
     - Multi-AI consensus is reached on the completeness of the work.

4. Once the PR is validated as ready for submission:
   - Proceed with the base `/gh-pr` command to create the Pull Request.
