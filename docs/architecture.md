# 아키텍처

`ai-cli-orch-wrapper`는 Claude Code에서 외부 AI CLI를 쓰기 쉽게 만드는 command
pack과 `aco` CLI 런타임을 함께 관리한다. 현재 저장소에는 두 실행면이 있다.

- **공개 npm 패키지**: `@pureliture/ai-cli-orch-wrapper`가 배포하는 Node.js
  wrapper CLI. 설치, command pack 배치, `aco sync`, `aco run`, provider 실행, 세션 로그를 담당한다.
- **Go 런타임**: `cmd/aco/`의 blocking runtime. `aco delegate`와 `aco run`을 통해
  agent frontmatter 기반 provider 실행을 실험한다. Go runtime의 process/env 보안 계약은 이
  경로에 적용되며, public npm wrapper의 Node provider 실행 경로와는 분리된다.

문서 기준 주요 provider는 **gemini**와 **codex**다.

## 아키텍처 개요

<p align="center">
  <img src="images/architecture-overview.svg" alt="System Architecture" width="100%" />
</p>

> 사람의 진입점인 Claude Code Harness에서 출발해, Node wrapper(`aco` CLI)는 command pack 설치·sync·provider 실행과 session lifecycle을, Go delegate runtime(`cmd/aco`)은 blocking provider 실행 실험을 각각 담당한다. provider 실행 결과는 모두 Session Store에 보존된다.

## 공개 패키지 CLI

이 저장소는 하나의 공개 npm 패키지와 하나의 공개 CLI를 대상으로 한다:

```text
npm package: @pureliture/ai-cli-orch-wrapper
CLI: aco
```

`aco`는 런타임 명령과 설정 명령을 모두 담당한다:

```text
aco run ...
aco pack install
aco pack setup
aco provider setup <name>
```

Node.js 래퍼는 gemini와 codex provider 흐름을 지원한다. 세션 명령도 담당한다:

```text
aco result [--session <id>]
aco status [--session <id>]
aco cancel [--session <id>]
```

## Go Delegate 런타임

Go 런타임은 blocking 방식이며 프로세스 중심으로 동작한다. Node 세션 저장소는 사용하지 않는다.
현재 공개 npm package의 session-aware `aco run/result/status/cancel` 표면은 Node wrapper가
담당한다. 아래 Go `aco run`은 `cmd/aco/` runtime 경로를 직접 사용할 때의 표면이다.

```text
aco delegate <agent-id> [--input <text>] [--formatter <path>] [--timeout <secs>]
aco run <provider> <command> [options]
```

`aco delegate`의 provider/model 선택은 agent spec과 formatter를 함께 사용해 결정한다:

1. `.claude/agents/<agent-id>.md`를 로드한다.
2. frontmatter에서 `modelAlias`와 `roleHint`를 읽는다.
3. `.aco/formatter.yaml`을 통해 provider/model을 해석한다.
4. 명시적으로 일치하는 route가 없으면 기본 formatter route로 폴백한다.

Go provider registry에는 현재 `codex`, `gemini`, `gemini_cli`가 등록되어 있다.

## 세션 생명주기

Node 래퍼 세션은 `packages/wrapper`의 `aco run <provider> <command>`에서만 생성된다.
세션 저장소는 태스크 메타데이터와 provider 출력을 `~/.aco/sessions/<uuid>/` 아래에 기록한다.

<p align="center">
  <img src="images/session-lifecycle.svg" alt="Session Lifecycle" width="100%" />
</p>

각 단계는 `~/.aco/sessions/<uuid>/`에 task metadata와 provider 출력으로 보존되며, `aco status`/`aco result`/`aco cancel`로 사후에 조작할 수 있다.

## Context 동기화

`aco sync`는 Claude Code 프로젝트 설정을 Codex와 Gemini의 프로젝트 단위 대상 파일로 변환한다.
저장소의 canonical Claude 파일을 읽고, `.aco/sync-manifest.json`에 해시를 추적하는 관리 산출물을 쓴다.

`aco sync`는 **default-deny** 정책으로 skill을 동기화한다. `.claude/skills/`의 모든 skill을 탐지하지만, `.agents/skills/`에 복사하는 대상은 명시적으로 허용된 ACO-owned 공유 정책/reference skill로 제한된다. OpenSpec, Superpowers 등 외부 tool의 skill은 외부 asset으로 분류되어 공유 표면에 복사되지 않는다. `gh-*` command-alias skill은 provider-specific 표면으로 분류된다.

<p align="center">
  <img src="images/context-sync.svg" alt="Context Sync Flow" width="100%" />
</p>

Source 영역(`.claude/`)은 사람이 관리하는 source of truth이고, Generated 영역은 `aco sync`가 manifest에 해시를 기록하며 관리하는 산출물이다. 운영자가 `aco sync --force`를 선택하지 않는 한 manifest가 소유한 대상에 drift가 있으면 덮어쓰지 않는다.

필드 변환 규칙, 경고, 충돌 처리 방식은 [reference/context-sync.md](reference/context-sync.md)를 참고한다.

## 저장소 구조

```text
packages/
  wrapper/     # public package implementation
  installer/   # internal transitional workspace (not public)
templates/
  commands/    # copied to .claude/commands/
  prompts/     # copied to .claude/aco/prompts/
```

<p align="center">
  <img src="images/repository-structure.svg" alt="Repository Structure" width="100%" />
</p>

상단은 5개의 최상위 영역(packages, Go runtime, templates, docs, .github/workflows)을, 하단은 harness surface의 사람-관리(`.claude/`)와 자동 생성(`aco sync` 산출물) 분리를 보여준다.

| 경로                  | 목적                                                     |
| --------------------- | -------------------------------------------------------- |
| `packages/wrapper/`   | Node.js `aco` CLI를 구현하는 공개 npm 패키지             |
| `packages/installer/` | 공개 패키지 표면이 아닌 내부 전환용 workspace            |
| `cmd/aco/`            | blocking `aco run`과 `aco delegate`를 위한 Go CLI 진입점 |
| `internal/provider/`  | Go provider 구현체와 provider registry                   |
| `internal/runner/`    | Go 프로세스 실행과 signal/timeout 처리                   |
| `templates/commands/` | `.claude/commands/`로 복사되는 slash command 템플릿      |
| `templates/prompts/`  | `.claude/aco/prompts/`로 복사되는 provider prompt 템플릿 |
| `.github/workflows/`  | CI, release, project 동기화 workflow                     |

## 주요 결정

### D1: 단일 공개 패키지

배포 대상은 `@pureliture/ai-cli-orch-wrapper` 하나뿐이다. 마이그레이션 중 내부 workspace가 남을 수 있지만, 공개 API에는 포함하지 않는다.

### D2: 단일 공개 CLI

`aco`만 공개 명령으로 둔다. 기존 installer 기능은 다음 명령으로 라우팅한다:

- `aco pack install`
- `aco pack setup`
- `aco pack status`
- `aco provider setup <name>`

### D3: 런타임 생명주기는 wrapper가 유지

`aco` CLI는 계속 다음 책임을 가진다:

- provider dispatch
- session/task 생명주기
- output/error 로그 처리
- cancellation/status 명령

### D4: Pack 설치는 파일 복사

`aco pack install`은 `templates/commands/`의 템플릿을 `.claude/commands/`로 복사한다. Node version manager 변경에 취약하므로 symlink는 계속 피한다.

### D5: Context sync는 관리 산출물을 사용

`aco sync`는 생성된 Codex/Gemini 대상 block을 소유하고 `.aco/sync-manifest.json`에 해시를 기록한다.
manifest가 소유한 대상에 drift가 있으면 운영자가 `aco sync --force`를 선택하기 전까지 덮어쓰지 않는다.
