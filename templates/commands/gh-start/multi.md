---
name: gh-start:multi
description: "GitHub issue start validation with multi-AI"
allowed-tools: [Bash]
---

# Multi-AI GH Start

This is the multi-provider variant of the `/gh-start` command.

## Instructions

1. Check if the `/octo:multi` skill is available in the current environment.

2. If `/octo:multi` is NOT available:
   - Display this message to the user: 'Please install octo skills first. Run: /octo:setup'
   - Do NOT proceed further.

3. If `/octo:multi` IS available:
   - Use it to validate that the specified issue is truly ready to start.
   - The validation should check for clear requirements, acceptance criteria, and necessary context.

4. Once the issue is validated as ready:
   - Proceed with the base `/gh-start` command to transition the issue state.
