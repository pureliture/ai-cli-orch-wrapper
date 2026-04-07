Create a GitHub Pull Request in `pureliture/ai-cli-orch-wrapper`. The PR body must be substantive — not boilerplate. Derive content from the linked issue and the actual changes made.

## Steps

1. Ask the user for the following if not already provided:
   - **Issue number** (N): The issue this PR closes
   - **Parent epic number** (optional): If this issue has a parent epic

2. Fetch context to write the body:
   ```bash
   gh issue view <N> --repo pureliture/ai-cli-orch-wrapper --json title,body,labels
   ```
   Also look at the actual changes: `git diff main...HEAD --stat` and `git log main...HEAD --oneline`.

3. Derive the PR title from the issue title:
   - Issue title format: `type: description` (e.g., `feat: add gh-pm-workflow-commands`)
   - PR title format: `type(scope): description` where scope is the affected area (e.g., `feat(pm-harness): add /gh-* pm workflow commands`)
   - Keep it under 72 characters.

4. Construct the PR body using the template below. Fill every section — do NOT leave placeholder text.

   ```
   Closes #<N>

   ## What

   <2–4 sentences describing what changed. Be specific: name the files, commands,
   or behaviors that are new or different. A reviewer who hasn't read the issue
   should understand the change from this paragraph alone.>

   ## Why

   <1–3 sentences explaining the motivation. Reference the issue context or the
   problem it solves. Avoid restating the title — add the "because" that isn't
   obvious from the title.>

   ## Changes

   <Bullet list of the concrete changes included in this PR. One line per logical
   change. Start each bullet with a verb (Add, Fix, Update, Remove, Refactor).
   Example:
   - Add `templates/commands/gh-issue.md` slash command
   - Fix `setup-github-labels.sh` to propagate upsert failures via exit code
   - Update `docs/pm-board.md` with V3 title convention and 3-axis command structure>

   ## Checklist
   - [ ] npm test passes
   - [ ] manual smoke test
   - [ ] docs updated if needed
   ```

   If a parent epic number was provided, append:
   ```

   > Note: manually check parent epic #<epic-N> checkbox after merge
   ```

5. Quality bar — before calling `gh pr create`, verify:
   - "What" section has at least 2 sentences and names specific artifacts
   - "Why" section explains motivation beyond restating the title
   - "Changes" has at least one bullet per logical unit of work
   - No section contains placeholder text like `<...>` or `TODO`

6. Create the PR:
   ```bash
   gh pr create \
     --repo pureliture/ai-cli-orch-wrapper \
     --title "<title>" \
     --body "<body>"
   ```

7. Report the created PR URL to the user.
