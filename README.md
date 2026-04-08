# ai-cli-orch-wrapper

provider 기반 Node.js wrapper runtime 위에 구성된, Gemini CLI와 GitHub Copilot CLI용 설치형 Claude Code command pack입니다.

## 설치

```bash
# 방법 1: npx 사용 (로컬 설치 불필요)
npx @pureliture/aco-install

# 방법 2: 이 저장소에서 직접 설치
npm install
aco-install pack setup
```

설치 후에는 배포된 CLI가 실제로 실행 가능한지 확인합니다.

```bash
npx @pureliture/aco-install --version
npx @pureliture/aco-wrapper --version
```

## Provider 설정

pack 설치가 끝났다면 provider별 설치/인증 상태를 설정합니다.

```bash
# Gemini CLI
aco-install provider setup gemini
# 설치되어 있지 않다면: npm install -g @google/gemini-cli

# GitHub Copilot CLI
aco-install provider setup copilot
# 설치되어 있지 않다면: npm install -g @github/copilot && gh auth login
```

## 명령어

| Command | Description |
|---|---|
| `/gemini:review [file]` | Gemini CLI로 코드 리뷰 수행 (`file`이 없으면 `git diff HEAD`) |
| `/gemini:adversarial [--focus security\|performance\|correctness] [file]` | 공격적 관점의 리뷰 수행 |
| `/gemini:rescue [--from file] [--error msg]` | 막혔을 때 세컨드 오피니언 받기 |
| `/gemini:result [<session-id>]` | 최근 세션 또는 지정 세션의 출력 조회 |
| `/gemini:status [<session-id>]` | 세션 또는 provider 상태 조회 |
| `/gemini:cancel [<session-id>]` | 실행 중인 세션 취소 |
| `/gemini:setup` | provider 설치 및 인증 가이드 출력 |
| `/copilot:*` | GitHub Copilot CLI에도 동일한 인터페이스 제공 |

## 런타임: `aco` CLI

`aco` wrapper는 실행, 세션, 출력 lifecycle을 관리합니다.

```bash
aco run gemini review            # wrapper를 통해 실행
aco run copilot adversarial      # wrapper를 통해 실행
aco result                       # 마지막 세션 출력 조회
aco result --session <id>        # 지정 세션 출력 조회
aco status                       # 마지막 세션 상태 조회
aco cancel --session <id>        # 실행 중인 세션 취소
```

세션은 `~/.aco/sessions/<uuid>/` 아래에 제한된 권한으로 저장됩니다.

| File | Permissions | Purpose |
|---|---|---|
| `task.json` | `0600` | provider, command, status, pid, timestamp 정보 |
| `output.log` | `0600` | provider 출력 스트림 |
| `error.log` | `0600` | provider stderr 및 wrapper 오류 상세 |

세션 디렉터리 자체는 `0700` 권한으로 생성됩니다.
## 저장소 구조

```text
packages/
  wrapper/          — @pureliture/aco-wrapper runtime (provider interface, session store, CLI)
  installer/        — @pureliture/aco-install CLI (pack install, provider setup)
templates/
...
  commands/         — Claude Code slash command templates (installed to .claude/commands/)
    gemini/
    copilot/
  prompts/          — Provider prompt templates (installed to .claude/aco/prompts/)
    gemini/
    copilot/
.github/
  prompts/          — OpenSpec prompt surfaces for GitHub-side agents
  skills/           — OpenSpec workflow skill definitions
.claude/
  commands/opsx/    — Claude-side OpenSpec command entry points
  skills/           — Claude-side OpenSpec workflow skills
openspec/           — Architecture specs and change proposals
  changes/          — Active OpenSpec changes
CLAUDE.md
README.md
package.json        — npm workspace root
```

## OpenSpec 워크플로

이 저장소는 OpenSpec 기반 변경 추적이 가능하도록 초기화되어 있습니다.

- 워크플로 자산은 `openspec/`, `.github/prompts/`, `.github/skills/`, `.claude/commands/opsx/`, `.claude/skills/` 아래에 있습니다.
- `openspec new change <name>`, `openspec list --json`, `openspec status --change <name> --json`으로 작업을 생성하거나 확인할 수 있습니다.
- 구현 준비가 끝난 change는 `openspec instructions apply --change <name> --json`으로 이어서 진행합니다.
- 완료 처리 전에는 `openspec validate <name>`로 artifact를 검증합니다.

## 개발

```bash
git clone <repo>
cd ai-cli-orch-wrapper
npm install
npm run build
```

빌드 순서는 중요합니다. `packages/wrapper`가 먼저 컴파일되어야 `packages/installer`를 빌드할 수 있습니다. 루트의 `npm run build` 스크립트가 이 순서를 강제합니다.

## 테스트

```bash
npm test            # packages/wrapper 단위 테스트 실행
npm run test:smoke  # provider 실행 가능 여부 smoke check
```

## 문제 해결

### `aco: command not found`

wrapper 바이너리를 명시적으로 설치합니다.

```bash
npm install -g @pureliture/aco-wrapper
```

### Provider를 찾을 수 없거나 인증되지 않은 경우

```bash
aco-install provider setup gemini
aco-install provider setup copilot
```

Gemini CLI는 `npm install -g @google/gemini-cli`로 설치합니다.  
Copilot CLI는 `npm install -g @github/copilot && gh auth login`으로 설치 및 인증합니다.

### 설치 후 slash command가 보이지 않는 경우

템플릿을 다시 복사합니다.

```bash
aco-install pack install
```

### `packages/installer` 빌드가 실패하는 경우

의존 순서대로 패키지를 빌드합니다.

```bash
npm run build --workspace=packages/wrapper
npm run build --workspace=packages/installer
```

## 배포

배포 순서는 다음과 같습니다.

```bash
npm run build
cd packages/wrapper && npm publish
cd ../installer && npm publish
```

## 문서

- [Architecture](docs/architecture.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Runbook](docs/RUNBOOK.md)
