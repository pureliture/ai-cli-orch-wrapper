---
description: "Review followup validation with multi-AI"
---

# Multi-AI GH Followup

This is the multi-provider variant of the `/gh-followup` command.

## Instructions

1. Check if the `/octo:multi` skill is available in the current environment.

2. If `/octo:multi` is NOT available:
   - Display this message to the user: 'Please install octo skills first. Run: /octo:setup'
   - Do NOT proceed further.

3. If `/octo:multi` IS available:
   - Use it to validate the content of the proposed review followup.
   - The validation should check for:
     - Clear and professional description.
     - Accurate classification of the issue type (task, chore, bug).
     - Proper linkage to the originating Pull Request.

4. Once the followup content is validated:
   - Proceed with the base `/gh-followup` command to create the issue and add it to the project backlog.
