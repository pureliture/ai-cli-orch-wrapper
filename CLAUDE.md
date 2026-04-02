# Claude Code Gemini/Copilot Spawn Pack

This repository only keeps the Claude Code assets needed to call Gemini CLI
and GitHub Copilot CLI from slash commands.

Kept surface:
- `.claude/aco/lib/adapter.sh`
- `.claude/aco/prompts/{gemini,copilot}/*`
- `.claude/commands/{gemini,copilot}/*`
- `.claude/aco/tests/*`

Excluded on purpose:
- GSD/OMX workflows
- Codex/Gemini/GitHub mirror surfaces
- planning and roadmap artifacts
- package-level CLI/runtime scaffolding

Maintenance rules:
- Add shared shell behavior only in `adapter.sh`.
- Keep command markdown files thin and adapter-specific.
- Keep prompt text under `.claude/aco/prompts/`.
- Run the shell tests in `.claude/aco/tests/` before and after behavior changes.
