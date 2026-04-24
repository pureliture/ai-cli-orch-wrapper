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
```

Gemini CLI: `npm install -g @google/gemini-cli`
Codex CLI: `npm install -g @openai/codex`

`aco provider setup`은 인증을 확인하기 전에 provider 바이너리부터 확인한다. 다음 fast-path source 중 하나가 있으면 인증 준비 완료로 판단한다:

| Provider | 인증 source |
| --- | --- |
| Gemini | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, 또는 `~/.gemini/oauth_creds.json` |
| Codex | `OPENAI_API_KEY` 또는 `~/.codex/auth.json` |

Codex가 만료된 OAuth 토큰을 보고하면 `codex login`을 실행한다. headless 또는 CI 환경에서는 Gemini에 `GEMINI_API_KEY`, Codex에 `OPENAI_API_KEY`를 우선 사용한다.

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
