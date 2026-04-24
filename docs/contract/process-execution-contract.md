# 프로세스 실행 계약

**상태:** 규범
**범위:** `cmd/aco` Go runtime의 `aco run`과 `aco delegate` 하위 명령
**참조:** `internal/runner/process.go`, `cmd/aco/cmd_run.go`, `cmd/aco/cmd_delegate.go`

---

## 1. 개요

이 문서는 `cmd/aco`에 구현된 Go runtime의 프로세스 실행 계층이 외부 프로바이더 바이너리를
어떻게 생성하고, 제어하고, 종료하는지를 규정한다. 계약의 목적은 외부 기여자가 Go runtime의
런타임 동작을 코드 읽기 없이 이해할 수 있도록 하는 것이다.

이 계약은 `packages/wrapper`의 public npm `aco run`, `aco status`, `aco result`, `aco cancel`
경로에는 그대로 적용되지 않는다. public npm CLI의 session-aware 실행은 Node wrapper 계약과
구현을 따른다.

`aco`는 `ccg-workflow/codeagent-wrapper/executor.go`의 프로세스 관리 패턴을 참조했다. 이 문서는 `aco` 구현의 관측 가능한 동작만을 다룬다. "호환성"이나 "호환되다"라는 표현은 사용하지 않는다.

---

## 2. 실행 모델

Go runtime의 `aco run`과 `aco delegate`는 동기(synchronous)이고 차단(blocking)된다.

```
호출자 (Bash tool, Claude Code Agent tool)
  │
  ▼
aco run <provider> <command>   ← 프로세스 종료까지 차단
  │
  ▼
외부 프로바이더 바이너리 (gemini, codex, 등)
  │
  ▼
stdout 스트리밍 → 호출자
프로세스 종료 → aco 종료
```

- 데몬 프로세스 없음
- 세션 레지스트리 없음 (Go 바이너리 기준)
- IPC 없음

---

## 3. 프로세스 생성

### 3.1 명령 구성

```go
cmd := exec.Command(provider.Binary(), args...)
```

`args`는 `Provider.BuildArgs(command, prompt, content, opts)`가 반환한다. 각 프로바이더는 자신의 CLI 규약에 맞춰 인자를 구성한다.

### 3.2 프로세스 그룹

`cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}`

모든 프로바이더 프로세스는 새로운 프로세스 그룹에서 실행된다. 이는 Node.js 기반 CLI(gemini, codex 등)가 워커 프로세스를 생성했을 때, `aco`가 전체 프로세스 트리를 종료할 수 있게 한다.

### 3.3 작업 디렉터리

`cmd.Dir`은 호출자의 현재 작업 디렉터리를 따른다. 기본값 `.`.

### 3.4 환경 변수

Go runtime 경로의 `cmd.Env`는 호스트의 전체 환경변수 목록에서 **allowlist**에 포함된 변수만
전달한다. 이 계약은 Node wrapper의 public `aco run` 경로에는 자동 적용되지 않는다. 현재
`packages/wrapper` 경로의 provider child process는 별도 `env` override 없이 `process.env`를
상속한다:

| 전달됨                                           | 차단됨             |
| ------------------------------------------------ | ------------------ |
| `PATH`, `HOME`, `USER`, `TERM`, `LANG`, `LC_ALL` | `ACO_API_KEY`      |
| `ACO_TIMEOUT_SECONDS`                            | `GOOGLE_API_KEY`   |
| `GEMINI_API_KEY` (CI/headless)                   | `COPILOT_TOKEN`    |
| `GITHUB_TOKEN` (CI/headless)                     | 기타 모든 환경변수 |
| `ANTHROPIC_API_KEY` (CI/headless)                |                    |

---

## 4. stdout/stderr 처리

### 4.1 stdout

프로바이더의 stdout은 **실시간**으로 호출자의 stdout에 스트리밍된다. 중간 버퍼링이나 파일 기록 없이 직접 전달된다.

- Go `aco run` 모드: `cmd.Stdout = os.Stdout`
- `aco delegate` 모드: `cmd.Stdout = sentinelWriter(w: d.stdout)`

### 4.2 stderr

stderr는 메모리 내 **tail buffer** (최대 64KB)에 캡처된다. 프로세스 종료 후 에러 분류(§7)에 사용된다. stdout으로는 전달되지 않는다.

### 4.3 Sentinel 출력 (delegate 모드만)

`aco delegate`는 프로바이더 출력 뒤에 JSON 메타데이터를 출력한다. `--no-meta` 플래그가 제공되면 생략된다:

```
ACO_META_<rid>: {"agent":"reviewer","provider":"gemini","model":"gemini-2.5","exit_code":0,"duration_ms":4200}
```

`<rid>`는 8바이트 무작위값, 16진수 인코딩. 이는 호출자(Claude Code)가 구조화된 메타데이터를 파싱할 수 있게 한다.

---

## 5. 취소 동작

### 5.1 OS 시그널 전달

`aco`가 `SIGTERM` 또는 `SIGINT`를 수신하면:

1. 프로세스 그룹 전체에 `SIGTERM` 전송 (`syscall.Kill(-pgid, syscall.SIGTERM)`)
2. `forceKillDelaySecs`(기본 5초) 후 `SIGKILL` 스케줄
3. 프로세스가 먼저 종료하면 예약된 `SIGKILL` 취소

### 5.2 타임아웃 취소

타임아웃 발생 시 동일한 패턴이 적용된다 (SIGTERM → grace period → SIGKILL).

---

## 6. 타임아웃

전체 실행은 `context.WithTimeout`으로 감싼다:

```go
ctx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
```

| 우선순위 | 출처                           | 기본값 |
| -------- | ------------------------------ | ------ |
| 1        | `--timeout` flag               | —      |
| 2        | `ACO_TIMEOUT_SECONDS` 환경변수 | —      |
| 3        | 하드코딩 기본값                | 300초  |

---

## 7. 종료 시맨틱

| 상황                            | ExitCode      | 에러 타입        |
| ------------------------------- | ------------- | ---------------- |
| 정상 종료                       | 0             | —                |
| 비정상 종료 (인증 아님)         | provider별 값 | `*ExitError`     |
| 인증 실패 (프로바이더 휴리스틱) | provider별 값 | `*AuthError`     |
| 타임아웃                        | 1             | `*TimeoutError`  |
| 시그널 종료                     | 1             | `*SignalError`   |
| 바이너리 없음                   | 1             | `*NotFoundError` |

에러 메시지에는 프로바이더 이름, exit code, stderr tail이 포함된다.

---

## 8. 인자 전달

`Provider.BuildArgs`는 다음 정보를 CLI 인자로 변환한다:

| 입력                     | 설명                                    |
| ------------------------ | --------------------------------------- |
| `command`                | 프롬프트 템플릿 식별자 (예: "review")   |
| `prompt`                 | 로드된 프롬프트 텍스트                  |
| `content`                | 사용자 입력 또는 stdin 내용             |
| `opts.PermissionProfile` | "default", "restricted", "unrestricted" |
| `opts.TimeoutSecs`       | 타임아웃 (초)                           |
| `opts.Model`             | 모델 식별자                             |
| `opts.ReasoningEffort`   | 추론 노력 수준                          |
| `opts.ExtraArgs`         | 추가 CLI 인자                           |

각 프로바이더는 자신의 CLI 규약에 맞춰 이 정보를 인자로 변환한다. 예: Gemini는 `gemini -p "<prompt>\n<content>" [--yolo]`.

---

## 9. 프롬프트 로딩

`prompt.Load(cwd, provider, command)`는 다음 순서로 프롬프트를 검색한다:

1. `./.claude/aco/prompts/<provider>/<command>.md` (cwd-local override)
2. `~/.claude/aco/prompts/<provider>/<command>.md` (global override)
3. 바이너리에 내장된 기본값 (embedded default)

내장 기본값은 `internal/prompt/defaults.go`에 정의된다. 파일이 없어도 실행 가능하다.

---

## 10. Delegate 명령 흐름

`aco delegate <agent-id>`의 전체 흐름:

```
1. 에이전트 스펙 로딩
   delegate.LoadAgentSpec(agentsDir, agentID)
   → 기본값: ".claude/agents", --agents-dir 옵션으로 커스텀 가능
   → frontmatter 파싱 (YAML) + body 추출

2. 포매터 로딩
   delegate.LoadFormatter(".aco/formatter.yaml")
   → provider/model 라우팅 규칙

3. 프로바이더/모델 결정
   delegate.Resolve(spec, formatter)
   → ModelAlias → RoleHint → fallback 순서로 결정

4. 프롬프트 구성
   delegate.BuildPrompt(spec, input)
   → PromptSeedFile + Body + Input 순서로 조합

5. 검증
   - 에이전트 ID 패턴: ^[a-z0-9-]+$
   - 실행 모드 "background"는 지원하지 않음
   - 파일 경로: ".." 컴포넌트 포함 시 거부

6. 실행
   runner.Run(ctx, opts)

7. Sentinel 출력 (옵션)
   JSON 메타데이터를 stdout에 추가
```

---

## 11. 제외 범위

이 문서는 다음을 다루지 않는다:

| 기능                     | 설명                                                  | 이유                          |
| ------------------------ | ----------------------------------------------------- | ----------------------------- |
| Windows 전용 처리        | `killProcessTree`, fallback exit timer                | Darwin/Linux 전용             |
| 브라우저 자동 오픈       | OAuth 흐름                                            | 프로바이더 CLI의 책임         |
| SSE/Web UI 스트리밍      | 서버-전송 이벤트                                      | blocking CLI의 범위 밖        |
| JSON 파서 기반 완료 감지 | `messageSeen`/`completeSeen`                          | blocking 모델에서 불필요      |
| 세션 기반 async 모델     | `task.json`, `output.log`, `aco cancel/status/result` | Go 바이너리는 blocking만 지원 |
| Supervisor 데몬          | 장기 실행 프로세스                                    | 필요 없음                     |
| Unix domain socket IPC   | 프로세스 간 통신                                      | 필요 없음                     |

---

## 12. ccg-workflow 참조

`aco`의 프로세스 실행 계층은 `ccg-workflow/codeagent-wrapper/executor.go`의 패턴을 참조했다. 구체적으로 다음 함수들의 논리를 가져왔다:

| aco 함수           | 참조 위치               |
| ------------------ | ----------------------- |
| `forwardSignals`   | `executor.go:1322-1358` |
| `terminateCommand` | `executor.go:1431-1467` |
| 메인 실행 루프     | `executor.go:966-1319`  |

### 의도적 차이점

| 항목          | ccg-workflow    | aco             | 근거                     |
| ------------- | --------------- | --------------- | ------------------------ |
| 프로세스 그룹 | 미사용          | `Setpgid: true` | Node.js 워커 종료 필요   |
| 환경변수      | 전체 전달       | allowlist 필터  | 보안 — API key 노출 방지 |
| 실행 모델     | 선택적 blocking | 항상 blocking   | 단순성, 대체 가능성 보장 |
| stdout        | 단일 스트리밍   | 단일 스트리밍   | 동일                     |
| stderr        | tail buffer     | tail buffer     | 동일                     |

---

## 13. 알려진 한계 및 향후 방향

- **runner.go의 StubRunner**: 현재 `internal/runner/runner.go`에는 `StubRunner`만 있고, 실제 구현은 `process.go`의 `ProcessRunner`에 있다. Phase B에서 인터페이스 정리가 필요하다.
- **prompt 로딩**: 현재 `embed.FS` 대신 맵 기반 내장값을 사용한다. Phase 4에서 `.md` 파일 기반으로 전환할 예정이다.
- **delegate 모드에서의 에러 분류**: `classifyDelegateError`는 항상 exit code 1을 반환. 향후 세분화 필요.
- **프로바이더 추가**: 현재 gemini와 codex만 지원. 새 프로바이더 추가 시 `Provider` 인터페이스 준수 필수.

이 문서는 `docs/contract/go-node-boundary.md`와 함께 읽어야 `aco`의 전체 아키텍처를 이해할 수 있다.
