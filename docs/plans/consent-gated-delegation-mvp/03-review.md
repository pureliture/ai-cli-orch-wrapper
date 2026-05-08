# Consent-Gated Delegation MVP Pre-Implementation Review

작성일: 2026-05-08

이 리뷰는 외부 Codex/Gemini availability에 의존하지 않는 manual 3-perspective review다. Context7은 Node.js `node:test` execution model 확인에만 사용했다.

## Perspective 1: Architecture / System Design

### Fit

- `aco ask`를 `aco run` 위의 high-level orchestration layer로 두는 방향은 기존 architecture와 맞다.
- `IProvider`와 `ProviderRegistry`에 `mock` provider를 추가하는 것은 provider-neutral extension point를 그대로 사용한다.
- Session lifecycle은 이미 `task.json` + `output.log`를 중심으로 작동하므로, ask MVP는 같은 session store를 재사용해야 한다.
- Run-level ledger는 multi-provider ask를 묶는 상위 artifact로 필요하지만, MVP에서는 JSON ledger와 markdown brief만으로 충분하다.

### Risks

- `cli.ts`가 이미 여러 command를 직접 포함하고 있어 `ask`까지 넣으면 파일이 더 커진다.
- `aco ask`가 real provider output을 stdout에 흘리면 canonical thesis의 token-saving 목표를 깨뜨린다.
- 여러 provider를 순차 실행하는 동안 하나가 실패하면 ledger/session 상태가 애매해질 수 있다.

### Recommendations

- `packages/wrapper/src/commands/ask.ts`로 command logic을 분리한다.
- `aco ask`는 `createOutputTee()`를 사용하지 않는다. full output은 file에 저장하고 stdout은 mode별로 명시적으로 제어한다.
- provider별 session은 독립적으로 만들고 run ledger에 각 session의 status를 기록한다.

## Perspective 2: Testing / Quality

### Fit

- Existing tests are Node `node:test`; adding `tests/ask-cli.test.ts` to the explicit package test list follows local pattern.
- CLI behavior should be tested by spawning the CLI with isolated `HOME`, because session artifacts live under `~/.aco`.
- `mock` provider should have direct provider tests and CLI integration tests.

### Risks

- Existing `ProviderRegistry.keys()` test asserts exact length `2`; adding `mock` must update it to membership-based assertions.
- Auth cache baseline failure blocks full `npm test` in the sandbox because cache path is resolved at module import time.
- CLI tests can leak sessions into the real user home if `HOME` isolation is missed.

### Recommendations

- Every CLI test should create a temp home and pass it through `env`.
- Assert no session directory exists for `--dry-run` and consent-required paths.
- Use `node --require tsx/cjs src/cli.ts` for targeted source CLI tests, then build and run dist CLI in final validation.
- Fix the auth-cache path as a baseline unblocker using the already failing test as RED.

## Perspective 3: Tech Debt / Security / Consent

### Fit

- `--yes` gate and `--dry-run` plan directly address silent external provider invocation risk.
- Default `restricted` permission profile reduces accidental file modification risk for Codex/Gemini provider invocations.
- Bounded brief by default reduces token pressure and discourages treating external output as the final answer.

### Risks

- `--input-file` can include sensitive files if the user points at them. MVP does not implement `.acoignore` or secret scanning.
- `--output-mode full` can still dump large output into Claude Code when explicitly requested.
- Prompt text alone cannot guarantee a provider will not modify files if the permission profile permits it.

### Recommendations

- Document that `--input-file` is explicit user-selected input and not protected by full security hardening in MVP.
- Keep default `--permission-profile restricted`.
- Include advisory warning in run ledger, session brief, and stdout brief.
- Do not add task-specific slash commands; put review/spec/plan differences into natural language and presets.

## Review Outcome

Proceed with MVP implementation. Scope remains intentionally narrow:

- implement `mock`
- implement `aco ask`
- implement consent gate and dry-run
- save artifacts
- add one `/aco` command and one `aco-delegation` skill
- update README/runbook

Do not implement doctor, aggregation, `findings.json`, `.acoignore`, or provider plugin architecture in this goal.

## Post-Implementation Review

### CLI UX

- `aco ask --dry-run` shows provider, permission profile, output mode, task, and input size without auth checks, sessions, or provider invocation.
- `aco ask` without `--yes` and without `--dry-run` exits before provider invocation with a consent-required message.
- Default provider is `mock` for MVP no-auth demo safety. Real providers remain explicit through `--providers codex,gemini`.

### Consent Safety

- `--yes` and `--dry-run` are mutually exclusive.
- Empty provider lists are rejected.
- Invalid provider names are rejected before any session is created.
- Preset names reject path traversal and only allow `[A-Za-z0-9][A-Za-z0-9_-]*`.

### Token-Saving Behavior

- Default output mode is `brief`.
- `brief` and `save-only` do not print full provider output.
- Full output is streamed to `output.log` and retrievable with `aco result`.
- `full` output mode is explicit and streams provider output to stdout while still saving artifacts.

### Test Coverage

- Added direct provider tests for `mock`.
- Added CLI tests for dry-run, consent gate, default provider, no implicit stdin wait, successful brief execution, save-only/full output modes, preset/input-file artifacts, provider failure artifact preservation, cancellation preservation, and argument validation.
- Smoke test now covers `mock` provider registration and availability.

### Tech Debt

- MVP still relies on provider-level/prompt-level restrictions rather than a complete sandbox.
- `aco result` remains session-oriented; multi-provider run-level result aggregation is a Goal 2 candidate.
- Secret scanning, `.acoignore`, and structured findings schema remain explicitly out of scope for this MVP.
