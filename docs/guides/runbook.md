# 운영 Runbook

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

또는 저장소에서:

```bash
npm install
npm run build
node packages/wrapper/dist/cli.js pack setup
```

## 일반적인 문제

### `aco: command not found`

```bash
npm install -g @pureliture/ai-cli-orch-wrapper
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
