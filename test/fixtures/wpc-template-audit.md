# Template Audit Report (WP-C)

## gemini/review.md: CLEAN
- Finding: Parses `$ARGUMENTS`, sources content via `git diff HEAD` or `cat $FILE`, dispatches to `aco run gemini review` via stdin. No violations.
- Action taken: None.

## gemini/adversarial.md: VIOLATION
- Finding: The file-argument branch assembled the prompt inline using `--input "$(printf 'Focus: %s\n\n%s' "$FOCUS" "$(cat "$FILE_ARG")")"`. This is inline prompt assembly — the template was building the prompt string and passing it as a flag value instead of letting `aco` construct it. The two branches also used inconsistent invocation styles (`--input` flag vs stdin pipe).
- Action taken: Removed the `--input` flag and inline `printf` prompt assembly. Both branches now source raw content (`cat $FILE` or `git diff HEAD`) into `$CONTENT` and pipe it to `aco run gemini adversarial --focus "$FOCUS"`. Focus is passed as a structured flag, not embedded in the prompt text.

## gemini/rescue.md: VIOLATION
- Finding: The template assembled a full prompt string (`FULL_CONTEXT`) by concatenating `git log -5 --oneline` output with the problem content under hardcoded section headers ("Recent git history:", "Problem:"). This is inline prompt assembly — the template was building the body of the prompt rather than letting `aco run gemini rescue` load it from the prompt template. The combined `--from` + `--error` branch also fused two content sources into a single formatted string.
- Action taken: Removed the `GIT_LOG` collection, `FULL_CONTEXT` construction, and the combined `--from` + `--error` fusion branch. The template now resolves `PROBLEM_CONTENT` from one source (file, error message, stdin, or positional arg) and pipes it directly to `aco run gemini rescue`. Git history injection is the responsibility of the `rescue` command inside `aco`.

## gemini/status.md: VIOLATION
- Finding: The no-argument branch called `aco-install provider setup gemini 2>&1 || true`. Provider health checking belongs in `aco-install provider setup`, not in the `status` command. This conflates session status with provider setup/auth verification.
- Action taken: Replaced the `aco-install provider setup gemini` call with `aco status`. Updated the description and prose to reflect that this command shows session status only; provider health checking is directed to `/gemini:setup`.

## gemini/result.md: CLEAN
- Finding: Parses `$ARGUMENTS` for an optional session ID and dispatches to `aco result` or `aco result --session $SESSION_ID`. No violations.
- Action taken: None.

## gemini/cancel.md: CLEAN
- Finding: Parses `$ARGUMENTS` for an optional session ID and dispatches to `aco cancel` or `aco cancel --session $SESSION_ID`. No violations.
- Action taken: None.

## gemini/setup.md: MINOR_ISSUE
- Finding: After calling `aco-install provider setup gemini`, the template emitted hardcoded advisory messages (`echo "If not installed: npm install -g @google/gemini-cli"` and `echo "Then authenticate: gemini auth login"`). These inline `echo` statements embed provider-specific install instructions that belong inside `aco-install`, not in the command template. The `|| true` also suppressed errors from `aco-install` unconditionally.
- Action taken: Removed the `echo` header, blank line echoes, and the two advisory `echo` lines. Removed the `|| true` suppression so `aco-install` exit codes propagate. The template now contains only: `aco-install provider setup gemini`.

---

## Summary

| File | Classification | Modified |
|---|---|---|
| gemini/review.md | CLEAN | No |
| gemini/adversarial.md | VIOLATION | Yes |
| gemini/rescue.md | VIOLATION | Yes |
| gemini/status.md | VIOLATION | Yes |
| gemini/result.md | CLEAN | No |
| gemini/cancel.md | CLEAN | No |
| gemini/setup.md | MINOR_ISSUE | Yes |

**Violations found: 3** (gemini/adversarial, gemini/rescue, gemini/status)
**Minor issues found: 1** (gemini/setup)
**Files modified: 4**
**Files unchanged: 3**

### Violation categories fixed
1. **Inline prompt assembly** — `adversarial`: removed `--input "$(printf ...)"` flag; content is now piped raw and focus passed as a structured flag.
2. **Inline prompt assembly** — `rescue`: removed `GIT_LOG` + `FULL_CONTEXT` construction with hardcoded section headers; raw content is piped and git history injection is deferred to `aco`.
3. **Status conflation** — `status`: replaced `aco-install provider setup gemini` with `aco status`; provider health checking belongs in `aco-install provider setup`, not in the session status command.
4. **Inline advisory output** — `setup` (MINOR_ISSUE): removed hardcoded install/auth echo instructions that belong inside `aco-install`; removed `|| true` error suppression.
