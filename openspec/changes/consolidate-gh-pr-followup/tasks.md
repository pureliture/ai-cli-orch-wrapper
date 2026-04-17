## 1. Deprecate and Remove `gh-followup`

- [x] 1.1 Remove `templates/commands/gh-followup.md` and `templates/commands/gh-followup/multi.md`
- [x] 1.2 Remove `.claude/commands/gh-followup.md` and `.claude/commands/gh-followup/multi.md`
- [x] 1.3 Remove `.gemini/commands/gh-followup.toml`

## 2. Create `gh-pr-followup` Command

- [x] 2.1 Create `templates/commands/gh-pr-followup.md` with instructions to fetch unresolved review threads via `gh api graphql`
- [x] 2.2 Add instructions to `gh-pr-followup.md` to guide AI on evaluating threads (immediate fix vs. defer to issue)
- [x] 2.3 Add bash snippets in `gh-pr-followup.md` to resolve threads (`addPullRequestReviewThreadReply` and `resolveReviewThread`)
- [x] 2.4 Add bash snippets in `gh-pr-followup.md` to create new issues with `origin:review` and add them to Project #3 Backlog
- [x] 2.5 Create `templates/commands/gh-pr-followup/multi.md` for `/octo:multi` verification

## 3. Synchronize Commands

- [x] 3.1 Copy `templates/commands/gh-pr-followup.md` and its `multi.md` to `.claude/commands/`
- [x] 3.2 Create `.gemini/commands/gh-pr-followup.toml` by parsing the frontmatter and body from the template

## 4. Documentation and Cleanup

- [x] 4.1 Update `docs/pm-board.md` to reflect the change from `/gh-followup` to the unified `/gh-pr-followup` command
- [x] 4.2 Verify that all commands load correctly and syntax is valid for both Claude Code and Gemini CLI
