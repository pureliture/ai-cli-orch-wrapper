# Consent-Gated External AI Delegation MVP Spec

## Product Thesis

`ai-cli-orch-wrapper`는 Claude Code 세션 안에서 사용자의 명시적 동의를 받은 뒤 Codex/Gemini 같은 외부 AI CLI에 작업을 위임하고, 결과는 session/run artifact로 저장하며, Claude Code에는 bounded brief만 반환해 토큰 사용량을 줄이는 generic external AI delegation wrapper다.

Claude Code는 supervisor와 final synthesizer로 남는다. 외부 provider output은 advisory이며 maintainer 판단, 테스트, 리뷰를 대체하지 않는다.

## User Stories

- 사용자는 Claude Code 안에서 `/aco "현재 diff를 외부 리뷰어처럼 검토해줘"`처럼 하나의 generic command로 외부 리뷰를 요청할 수 있다.
- 사용자는 provider 실행 전에 어떤 provider, task, input source, permission profile, output mode가 쓰일지 `--dry-run`으로 확인할 수 있다.
- 사용자는 명시적으로 `--yes`를 붙인 경우에만 provider 실행을 허용한다.
- 사용자는 full provider output을 Claude Code 토큰으로 바로 소비하지 않고, brief만 보고 필요할 때 `aco result`로 full output을 조회한다.
- 사용자는 Codex/Gemini credential 없이도 `mock` provider로 end-to-end session/result workflow를 검증할 수 있다.

## Non-Goals

- production-grade `aco doctor`는 구현하지 않는다.
- full security hardening, secret scanning, `.acoignore` enforcement는 구현하지 않는다.
- advanced aggregation, `findings.json`, provider output normalization은 구현하지 않는다.
- npm publish, GitHub issue/PR/release 생성은 하지 않는다.
- `/aco:review`, `/aco:spec-review`, `/aco:plan-review`, `/aco:security-review` 같은 slash command explosion은 만들지 않는다.
- real Codex/Gemini credential을 MVP demo 성공 조건으로 요구하지 않는다.

## Consent Model

`aco ask`는 provider execution을 다음 세 상태로 나눈다.

| Invocation                    | Provider invoked? | Session created? | Exit                      |
| ----------------------------- | ----------------- | ---------------- | ------------------------- |
| `aco ask ... --dry-run`       | No                | No               | `0`                       |
| `aco ask ...` without `--yes` | No                | No               | non-zero                  |
| `aco ask ... --yes`           | Yes               | Yes              | provider result dependent |

Consent-required message는 사용자가 다시 실행할 정확한 방향을 알려야 한다:

- `--dry-run`으로 실행 계획 확인
- `--yes`로 provider 실행 동의

## Token-Saving Output Model

`aco ask`의 output mode:

- `brief` (default): stdout에는 bounded brief와 artifact 위치만 출력한다. full provider output은 session `output.log`에 저장한다.
- `save-only`: stdout에는 run/session id와 저장 위치만 출력한다.
- `full`: 사용자가 명시한 경우에만 full provider output을 stdout에 출력한다. 그래도 full output은 session `output.log`에 저장한다.

Brief는 provider별 session id, artifact path, advisory warning, 짧은 bounded summary만 포함한다. MVP brief는 structured findings extraction을 하지 않는다.

## `aco ask` Command Contract

```text
aco ask
  --providers codex,gemini,mock
  --task "<natural language task>"
  --input "<text>"
  --input-file <path>
  --preset <name>
  --permission-profile restricted|default|unrestricted
  --output-mode brief|save-only|full
  --yes
  --dry-run
```

Defaults:

- `--providers`: `mock` for MVP no-auth safety; use `--providers codex,gemini` explicitly for real external CLIs.
- `--permission-profile`: `restricted`
- `--output-mode`: `brief`

Validation:

- `--task` or `--preset` is required.
- `--providers` must resolve to registered providers.
- `--permission-profile` must be one of `restricted`, `default`, `unrestricted`.
- `--output-mode` must be one of `brief`, `save-only`, `full`.
- `--yes` and `--dry-run` are mutually exclusive.
- `--input-file` must be readable when provided.

Prompt construction:

- Prompt includes advisory role, user task, optional preset content, permission profile, and instruction not to modify files under `restricted`.
- Input content is taken from explicit `--input` and `--input-file` values. MVP `aco ask` does not implicitly wait on stdin.

## Generic `/aco` Claude Code Command

`.claude/commands/aco.md` is the only new Claude Code slash command.

Behavior:

- Accepts natural language `$ARGUMENTS`.
- Explains that provider execution requires user consent.
- Delegates to `aco ask --task "$ARGUMENTS"` with an explicit dry-run first or clear command examples.
- Does not create task-specific slash command variants.

## `aco-delegation` Skill Behavior

`.claude/skills/aco-delegation/SKILL.md` teaches Claude Code when to suggest `aco ask`:

- Use when the task benefits from a second AI reviewer, broad critique, or token-saving external review.
- Ask or confirm before provider execution.
- Prefer `--dry-run` before `--yes` when the user has not already consented.
- Keep Claude as supervisor and final synthesizer.
- Treat external output as advisory.
- Do not suggest `aco ask` for secrets, credential-heavy inputs, or commands that require silent provider execution.

## Mock Provider / No-Auth Demo

`mock` provider:

- Is always available.
- Requires no auth.
- Produces deterministic output.
- Clearly labels itself as `Mode: deterministic demo`.
- Uses the same provider interface and session/result lifecycle as real providers.
- Must work with:

```bash
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief
node packages/wrapper/dist/cli.js result
```

## Artifact Model

MVP run artifacts:

```text
~/.aco/runs/<run-id>/ledger.json
~/.aco/runs/<run-id>/brief.md
```

MVP session artifacts:

```text
~/.aco/sessions/<session-id>/task.json
~/.aco/sessions/<session-id>/input.md
~/.aco/sessions/<session-id>/prompt.md
~/.aco/sessions/<session-id>/output.log
~/.aco/sessions/<session-id>/brief.md
```

`ledger.json` records:

- run id
- created timestamp
- task
- providers
- permission profile
- output mode
- session ids
- advisory warning

## Compatibility

- Existing `aco run <provider> <command>` behavior remains compatible.
- Existing `aco result`, `aco status`, and `aco cancel` continue to work with old sessions.
- New `aco ask` sessions use command value `ask`, so existing status/result logic can read them.
- `aco result` continues to print `output.log` by default, which satisfies full output retrieval for MVP.

## Acceptance Criteria

- `aco ask --providers mock --task "review this demo input" --input "demo" --dry-run` does not invoke providers and creates no sessions.
- `aco ask --providers mock --task "review this demo input" --input "demo"` does not invoke providers and prints consent-required guidance.
- `aco ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief` creates run/session artifacts, prints bounded brief, and does not dump full output.
- `aco ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode full` prints full mock output only because `full` was explicit.
- `aco result` after a successful mock ask prints the full deterministic provider output.
- `mock` is registered in `ProviderRegistry`.
- Default permission profile for `aco ask` is `restricted`.
- Default output mode for `aco ask` is `brief`.
- No task-specific Claude slash commands are added.
- README/runbook document the no-auth MVP demo and advisory output model.
