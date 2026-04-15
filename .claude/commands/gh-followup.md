---
name: gh-followup
description: "Review followup issue creation and Project #3 backlog addition"
allowed-tools: [Bash]
---

# GH Followup

This command creates a post-review followup issue and adds it to Project #3.

## Instructions

1. Ask the user for the following details:
   - PR Number: The Pull Request that originated this followup.
   - Description: A clear description of the followup work.
   - Type: Choose between 'task', 'chore', or 'bug'.

2. Create the GitHub issue by running the `gh issue create` command with these parameters:
   - Repository: `pureliture/ai-cli-orch-wrapper`
   - Title: Use the format `<type>: <description>`
   - Labels: Apply `type:<type>` and `origin:review`
   - Body: 
     Line 1: `From: #<PR_NUMBER> review comment`
     Line 2: (empty)
     Line 3: `<description>`
     Line 4: (empty)
     Line 5: `See also: #<PR_NUMBER>`

3. Once the issue is created, extract the issue URL from the command output.

4. Add the new issue to the Project #3 Backlog by running `gh project item-add 3 --owner pureliture --url <issue_url>`.

5. Confirm to the user that the issue has been created and added to the project backlog.
