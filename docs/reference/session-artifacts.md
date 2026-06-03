# Session And Run Artifacts

작성일: 2026-05-08

`aco ask`와 `aco run`은 provider output을 stdout에만 남기지 않고 사용자 홈의 `~/.aco/` 아래에 저장한다. Goal 2 기준 artifact contract는 `aco ask`의 run/session layout을 문서화하는 v1이다.

Terminology reference: [Ubiquitous Language](ubiquitous-language.md) defines `run`, `session`, `artifact`, `brief`, and `output.log`.

## Why Artifacts Exist

Claude Code 세션 안에서는 token-saving이 중요하다. `aco ask --output-mode brief`는 bounded summary만 보여 주고, full provider output은 artifact로 저장한다. 스킬 위임 흐름 내부에서 필요한 경우 `aco result` 또는 artifact 파일을 통해 full output을 다시 확인한다.

## `aco ask` Run Layout

한 번의 `aco ask` 실행은 하나의 run을 만든다. multi-provider 실행이면 run 하나 안에 provider별 session이 여러 개 기록된다.

```text
~/.aco/runs/<run-id>/
├── ledger.json
└── brief.md
```

### `ledger.json`

Run-level machine-readable ledger다.

Current fields:

- `runId`
- `createdAt`
- `task`
- `preset`
- `providers`
- `permissionProfile`
- `outputMode`
- `timeoutSeconds`
- `advisory`
- `sessions`

Each `sessions[]` entry includes:

- `id`
- `provider`
- `status`
- `outputLog`
- `briefPath`
- `summary`
- `error` when applicable

### `brief.md`

Run-level human-readable brief다. It includes status, session IDs, full output paths, and bounded provider summaries. It intentionally avoids full provider output, but it can still contain provider-echoed task input or sensitive text if the provider included that content near the beginning of its output. Inspect it before sharing.

## `aco ask` Session Layout

Each provider invocation gets one session directory.

```text
~/.aco/sessions/<session-id>/
├── task.json
├── input.md
├── prompt.md
├── output.log
├── brief.md
└── error.log        # only when provider execution fails or is cancelled with an error
```

### `task.json`

Session metadata used by `aco status`, `aco result`, and `aco cancel`.

Important fields:

- `id`
- `provider`
- `command`
- `status`
- `permissionProfile`
- `startedAt`
- `endedAt`
- `pid` when known

### `input.md`

The raw explicit input passed through `--input` and `--input-file`.

Goal 2 preserves leading spaces, trailing spaces, and trailing newlines. When both sources are used, the join is deterministic:

```text
<--input content>

<--input-file content>
```

That separator is exactly two newline characters between explicit input sources.

### `prompt.md`

The prompt sent to the provider. It includes the advisory notice, permission profile guidance, optional preset instructions, and the task text.

### `output.log`

Full provider output. `aco result` reads this file for the latest session unless `--session <id>` is supplied.

### `brief.md`

Human-readable session summary with:

- run ID
- provider
- session ID
- status
- full output path
- bounded summary
- advisory notice
- error if applicable

### `error.log`

Created when provider execution fails or a cancellation path records an error. It is not created for successful sessions.

## Timeout And Cancellation

`aco run` and provider-invoking `aco ask --yes` apply provider execution timeout in this order:

1. `--timeout <seconds>`
2. `ACO_TIMEOUT_SECONDS`
3. default `300` seconds

Invalid timeout values are rejected before a provider session is created.

When timeout occurs, the wrapper best-effort terminates the provider process, marks the session `failed`, preserves partial `output.log`, and writes the timeout reason to `error.log`.

When `aco cancel --session <id>` cancels a running session, the wrapper marks the session `cancelled`, writes `error.log`, and best-effort terminates the provider process. If the original `aco run` or `aco ask --yes` process later observes that status, it does not overwrite `cancelled` with `done` or `failed`.

`task.json` includes `pid` when the provider implementation exposes a spawned child process PID. `aco status --session <id>` reports the PID when present.

## Output Modes

| Mode        | stdout behavior                                   | Artifact behavior            |
| ----------- | ------------------------------------------------- | ---------------------------- |
| `brief`     | Prints run/session metadata and bounded summaries | Saves full output and briefs |
| `save-only` | Prints only run/session save locations            | Saves full output and briefs |
| `full`      | Prints full provider output intentionally         | Saves full output and briefs |

`brief` summary bound: 600 characters per provider session.

## What Is Not Implemented

- No `findings.json` schema is implemented in Goal 2.
- No automatic secret scanning is implemented.
- No `.acoignore` enforcement is implemented.
- No remote provider auth verification is performed from artifacts.

## Inspecting Artifacts

```bash
node packages/wrapper/dist/cli.js result
node packages/wrapper/dist/cli.js status
cat ~/.aco/runs/<run-id>/ledger.json
cat ~/.aco/sessions/<session-id>/brief.md
cat ~/.aco/sessions/<session-id>/output.log
```
