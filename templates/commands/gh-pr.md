Create a GitHub Pull Request in `pureliture/ai-cli-orch-wrapper` with a conventional commit title, `Closes #N` reference, CI checklist, and Epic reminder.

## Steps

1. Ask the user for the following if not already provided:
   - **Issue number** (N): The issue this PR closes (e.g., `25`)
   - **PR title**: In `type: description` format matching the issue title (e.g., `feat: add gh-pm-workflow-commands`)
   - **Parent epic number** (optional): If this issue has a parent epic

2. Construct the PR body:
   ```
   Closes #<N>

   ## Checklist
   - [ ] npm test passes
   - [ ] manual smoke test
   - [ ] docs updated if needed
   ```
   If a parent epic number was provided, append:
   ```

   > Note: manually check parent epic #<epic-N> checkbox after merge
   ```

3. Create the PR:
   ```bash
   gh pr create \
     --repo pureliture/ai-cli-orch-wrapper \
     --title "<title>" \
     --body "<body>"
   ```

4. Report the created PR URL to the user.
