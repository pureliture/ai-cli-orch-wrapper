Create a GitHub issue in `pureliture/ai-cli-orch-wrapper` following the conventional commit title format, with appropriate labels and automatic Project #3 Backlog assignment.

## Steps

1. Ask the user for the following information if not already provided:
   - **Title**: Full issue title in `type: description` format. Valid types: `feat`, `fix`, `bug`, `chore`, `task`, `spike`, `epic`. Example: `feat: add gh-pm-workflow-commands`. Do NOT use `[Sprint V3][Task]` prefix — that convention is deprecated as of V3.
   - **Parent epic** (optional): Epic issue number to link as parent (e.g., `22`)

2. Infer the `type:*` label from the title prefix:
   - `feat:` → `type:feature`
   - `fix:` or `bug:` → `type:bug`
   - `chore:` → `type:chore`
   - `task:` → `type:task`
   - `spike:` → `type:spike`
   - `epic:` → `type:epic`

3. Construct the issue body:
   - If a parent epic number was provided, the first line of the body MUST be: `Parent epic: #<N>`
   - Otherwise, leave the body empty.

4. Create the issue:
   ```bash
   gh issue create \
     --repo pureliture/ai-cli-orch-wrapper \
     --title "<title>" \
     --label "<type-label>,sprint:v3" \
     --body "<body>"
   ```

5. Capture the created issue URL from the output.

6. Add the issue to Project #3 Backlog:
   ```bash
   gh project item-add 3 --owner pureliture --url <issue_url>
   ```

7. Report the created issue URL and number to the user.
