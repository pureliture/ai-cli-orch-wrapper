---
description: "GitHub issue creation with multi-AI consensus"
---

# Multi-AI GH Issue

This is the multi-provider variant of the `/gh-issue` command.

## Instructions

1. Check if the `/octo:multi` skill is available in the current environment.

2. If `/octo:multi` is NOT available:
   - Display this message to the user: 'Please install octo skills first. Run: /octo:setup'
   - Do NOT proceed further.

3. If `/octo:multi` IS available:
   - Use it to get multi-AI consensus on the issue's scope and title.
   - Ensure that multiple models agree that the issue is well-defined and follows project standards.

4. Once consensus is reached and validation is complete:
   - Proceed with the base `/gh-issue` command to create the issue.
