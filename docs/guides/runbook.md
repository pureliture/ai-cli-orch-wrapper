# 운영 Runbook

## No-Auth Consent-Gated Demo

Use the built Node wrapper for the public CLI path:

```bash
npm run build
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --dry-run
node packages/wrapper/dist/cli.js ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief
node packages/wrapper/dist/cli.js result
node packages/wrapper/dist/cli.js doctor
```

Expected behavior:

- `--dry-run` shows the plan and prints `Provider execution: skipped`.
- `--yes --output-mode brief` creates run/session artifacts and prints a bounded summary, not full provider output.
- `aco result` prints the full deterministic mock output from `output.log`.
- `aco doctor` prints local diagnostics only. It does not call real providers or verify remote auth. It uses `HOME` or `USERPROFILE` heuristics for credential paths, and falls back gracefully when neither is set.

## Inspecting Artifacts

```bash
aco status
aco result
cat ~/.aco/runs/<run-id>/ledger.json
cat ~/.aco/sessions/<session-id>/brief.md
cat ~/.aco/sessions/<session-id>/output.log
```

See [Session And Run Artifacts](../reference/session-artifacts.md).

## Safety Reminder

Do not pass secrets, credential files, private tokens, or unrelated private files through `--input` or `--input-file`. `.acoignore.example` is an example policy file only; Goal 2 does not enforce `.acoignore`.

See [Security Model](../security.md).

## 배포

### 1. 빌드

```bash
npm run build
```

### 2. 패키지 배포

```bash
cd packages/wrapper
npm publish
```

### 3. 검증

```bash
npx @pureliture/ai-cli-orch-wrapper --version
```

## 설치

```bash
npx @pureliture/ai-cli-orch-wrapper pack setup
```

local tarball을 검증할 때:

```bash
npm install
npm run build --workspace=packages/wrapper
npm pack --workspace=packages/wrapper --pack-destination /tmp/aco-pack
npm install -g /tmp/aco-pack/pureliture-ai-cli-orch-wrapper-<version>.tgz
aco pack setup
```

또는 저장소 checkout에서:

```bash
npm install
npm run build --workspace=packages/wrapper
node packages/wrapper/dist/cli.js pack setup
```

`aco pack setup`은 `.claude/commands`, `.claude/aco/prompts`, `.claude/aco/tasks`를 설치한다.
기본 task preset은 `review`, `spec-critique`, `plan-critique`, `tdd`, `code-simplify`,
`default`다.
설치 후 sync 실패가 출력되면 setup에 사용한 것과 같은 entrypoint로 `pack uninstall`을
실행한다. `--global` setup은 `pack uninstall --global`로 복구한다.

## Pack Runtime Contract 검증

provider 실행 없이 source/package/tarball 계약을 확인한다.

```bash
npm run build --workspace=packages/wrapper
npm run test:pack-runtime-contract --workspace=packages/wrapper
```

copy-paste pilot:

```bash
aco pack setup
aco ask --preset review --dry-run
aco ask --preset spec-critique --dry-run
aco ask --preset plan-critique --dry-run
aco ask --preset tdd --dry-run
aco run gemini review --input "demo"
aco run codex review --input "demo"
```

위 `aco run` 두 명령은 실제 provider CLI와 로컬 credential이 준비된 경우에만 실행한다. CI/기본 검증에서는 `test:pack-runtime-contract`의 fake provider smoke와 `aco ask --preset ... --dry-run`을 사용한다.

## 일반적인 문제

## Consent-Gated Delegation MVP

`aco ask`는 Claude Code 세션에서 외부 AI CLI에 advisory 작업을 위임하기 위한 high-level 명령이다.
외부 provider는 `--yes` 없이는 실행되지 않는다.

```bash
# provider 실행 없이 계획만 확인
aco ask --providers mock --task "review this demo input" --input "demo" --dry-run

# 명시 동의 후 mock provider로 no-auth demo 실행
aco ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief

# full provider output 조회
aco result
```

기본 permission profile은 `restricted`이고 기본 output mode는 `brief`다. full output은
`~/.aco/sessions/<session-id>/output.log`에 저장되며, run-level 요약은
`~/.aco/runs/<run-id>/brief.md`와 `ledger.json`에 저장된다.

`aco run`은 기본적으로 `stream-only` 출력 정책을 사용하고, `aco ask`의 `brief` 모드만
`bounded` 출력 정책을 사용해 preview 크기를 제한한다.

실제 Codex/Gemini provider를 호출할 때도 같은 동의 규칙을 적용한다. external provider output은
advisory이며, 최종 판단과 종합은 Claude Code와 maintainer가 수행한다.

### `aco: command not found`

```bash
npm run build --workspace=packages/wrapper
node packages/wrapper/dist/cli.js --version
```

### Provider를 찾을 수 없거나 인증되지 않은 경우

```bash
aco provider setup gemini
aco provider setup codex
aco run gemini review
aco status --session <id>
```

Gemini CLI: `npm install -g @google/gemini-cli`
Codex CLI: `npm install -g @openai/codex`

`aco provider setup`은 provider 바이너리부터 확인한 뒤 local credential readiness를 휴리스틱으로
확인한다. 다음 fast-path source 중 하나가 있으면 로컬 credential이 준비된 것으로 본다. 이
검사는 remote 인증 검증이 아니다.

| Provider | 인증 source                                                           |
| -------- | --------------------------------------------------------------------- |
| Gemini   | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, 또는 `~/.gemini/oauth_creds.json` |
| Codex    | `OPENAI_API_KEY` 또는 `~/.codex/auth.json`                            |

Codex OAuth 파일에 만료 시간이 있고 만료된 경우에는 `codex login`을 실행한다. headless 또는
CI 환경에서는 Gemini에 `GEMINI_API_KEY`, Codex에 `OPENAI_API_KEY`를 우선 사용한다.

`aco run <provider> <command>`는 provider 실행 전에 runtime dashboard를 stderr에 출력한다. TTY에서 실행하면 ANSI 색/이모지가 붙으며, CI 또는 `NO_COLOR` 설정 시에는 순수 텍스트로 출력되어 로그/스크립트 파이프에서 안정적이다.

대시보드에는 다음 정보가 포함된다.

- Active: provider, command, session id, permission profile, branch, prompt template
- Exposed: provider agents, shared skills, hook/settings files
- Auth: `ready`/`not ready`와 method (`api-key`, `oauth`, `cli-fallback`, `missing`)

### 설치 후 slash command가 보이지 않는 경우

```bash
aco pack install
```

템플릿은 `templates/commands/`에서 `.claude/commands/`로 복사된다.

## 세션 데이터

세션은 `~/.aco/sessions/<uuid>/`에 저장된다.

```bash
aco status
aco result
aco cancel --session <id>
```
