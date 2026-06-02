# Template Audit Report (WP-C)

## antigravity/review.md: CLEAN
- Finding: Parses `$ARGUMENTS`, sources content via `git diff HEAD` or `cat $FILE`, dispatches to `aco run antigravity review` via stdin. No violations.
- Action taken: None.

## antigravity/adversarial.md: VIOLATION
- Finding: The file-argument branch assembled the prompt inline using `--input "$(printf 'Focus: %s\n\n%s' "$FOCUS" "$(cat "$FILE_ARG")")"`. This is inline prompt assembly — the template was building the prompt string and passing it as a flag value instead of letting `aco` construct it. The two branches also used inconsistent invocation styles (`--input` flag vs stdin pipe).
- Action taken: Removed the `--input` flag and inline `printf` prompt assembly. Both branches now source raw content (`cat $FILE` or `git diff HEAD`) into `$CONTENT` and pipe it to `aco run antigravity adversarial --focus "$FOCUS"`. Focus is passed as a structured flag, not embedded in the prompt text.

## antigravity/rescue.md: VIOLATION
- Finding: The template assembled a full prompt string (`FULL_CONTEXT`) by concatenating `git log -5 --oneline` output with the problem content under hardcoded section headers ("Recent git history:", "Problem:"). This is inline prompt assembly — the template was building the body of the prompt rather than letting `aco run antigravity rescue` load it from the prompt template. The combined `--from` + `--error` branch also fused two content sources into a single formatted string.
- Action taken: Removed the `GIT_LOG` collection, `FULL_CONTEXT` construction, and the combined `--from` + `--error` fusion branch. The template now resolves `PROBLEM_CONTENT` from one source (file, error message, stdin, or positional arg) and pipes it directly to `aco run antigravity rescue`. Git history injection is the responsibility of the `rescue` command inside `aco`.

## antigravity/status.md: VIOLATION
- Finding: The no-argument branch called `aco-install provider setup antigravity 2>&1 || true`. Provider health checking belongs in `aco-install provider setup`, not in the `status` command. This conflates session status with provider setup/auth verification.
- Action taken: Replaced the `aco-install provider setup antigravity` call with `aco status`. Updated the description and prose to reflect that this command shows session status only; provider health checking is directed to `/antigravity:setup`.

## antigravity/result.md: CLEAN
- Finding: Parses `$ARGUMENTS` for an optional session ID and dispatches to `aco result` or `aco result --session $SESSION_ID`. No violations.
- Action taken: None.

## antigravity/cancel.md: CLEAN
- Finding: Parses `$ARGUMENTS` for an optional session ID and dispatches to `aco cancel` or `aco cancel --session $SESSION_ID`. No violations.
- Action taken: None.

## antigravity/setup.md: MINOR_ISSUE
- Finding: After calling `aco-install provider setup antigravity`, the template emitted hardcoded advisory messages (`echo "If not installed: curl -fsSL https://antigravity.google/cli/install.sh | bash"` and `echo "Then authenticate: agy (OS Keyring/login)"`). These inline `echo` statements embed provider-specific install instructions that belong inside `aco-install`, not in the command template. The `|| true` also suppressed errors from `aco-install` unconditionally.
- Action taken: Removed the `echo` header, blank line echoes, and the two advisory `echo` lines. Removed the `|| true` suppression so `aco-install` exit codes propagate. The template now contains only: `aco-install provider setup antigravity`.

---

## Summary

| File | Classification | Modified |
|---|---|---|
| antigravity/review.md | CLEAN | No |
| antigravity/adversarial.md | VIOLATION | Yes |
| antigravity/rescue.md | VIOLATION | Yes |
| antigravity/status.md | VIOLATION | Yes |
| antigravity/result.md | CLEAN | No |
| antigravity/cancel.md | CLEAN | No |
| antigravity/setup.md | MINOR_ISSUE | Yes |

**Violations found: 3** (antigravity/adversarial, antigravity/rescue, antigravity/status)
**Minor issues found: 1** (antigravity/setup)
**Files modified: 4**
**Files unchanged: 3**

### Violation categories fixed
1. **Inline prompt assembly** — `adversarial`: removed `--input "$(printf ...)"` flag; content is now piped raw and focus passed as a structured flag.
2. **Inline prompt assembly** — `rescue`: removed `GIT_LOG` + `FULL_CONTEXT` construction with hardcoded section headers; raw content is piped and git history injection is deferred to `aco`.
3. **Status conflation** — `status`: replaced `aco-install provider setup antigravity` with `aco status`; provider health checking belongs in `aco-install provider setup`, not in the session status command.
4. **Inline advisory output** — `setup` (MINOR_ISSUE): removed hardcoded install/auth echo instructions that belong inside `aco-install`; removed `|| true` error suppression.
