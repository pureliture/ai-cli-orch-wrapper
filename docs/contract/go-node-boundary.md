# Go/Node.js 계약 경계

이 문서는 `aco` CLI의 Go 바이너리 (`cmd/aco/`)와 Node.js 래퍼 (`packages/wrapper/`) 간의 책임 경계를 정의하여 contract drift를 방지한다.

---

## Go 바이너리 책임 (검증 및 보안)

Go 바이너리가 전적으로 담당하는 레이어:

### 1. Frontmatter Parsing

`cmd_delegate.go`의 `--input` flag에서 수신한 markdown/frontmatter를 파싱하여 `command`, `model`, `timeout` 등의 메타데이터를 추출한다.

### 2. Formatter Routing

파싱된 frontmatter의 `format` 필드를 기반으로 출력 포맷터를 라우팅한다.

### 3. CLI Flag Validation

- `--input` 값이 비어있지 않은지 검증
- `--timeout` 값이 양의 정수인지 검증
- `--model` 값이 제공된 경우 유효한 모델 식별자인지 검증

### 4. Provider 바이너리 실행

프로바이더 바이너리를 자식 프로세스로 실행한다. Go 레이어는 `exec.Command`로 프로세스를 구성하고 `cmd.Start`/`cmd.Wait`로 실행 및 종료를 관리한다. 실행 가능한 바이너리를 찾지 못하거나 시작에 실패하면 즉시 에러를 반환한다.

### 5. 파일 경로 검증 (보안)

모든 파일 경로 입력에 대해:

- `path/filepath.Clean()`로 정규화
- `..` 컴포넌트 포함 여부 검사 (`filepath.IsAbs` + `strings.Contains`)
- 절대 경로와 상대 경로 모두 검증
- 검증 실패 시 실행 거부

### 6. 환경 변수 Allowlist

Go runtime 경로에서 프로바이더 실행 시 환경 변수를 allowlist 기반으로 필터링한다. 아래 변수만
프로바이더 프로세스에 전달되며, 나머지는 모두 차단된다. 이 allowlist는 Node wrapper의 public
`aco run` 경로에는 적용되지 않는다.

| Variable                 | 설명                         |
| ------------------------ | ---------------------------- |
| `ACO_TIMEOUT_SECONDS`    | 타임아웃 값 (초 단위)        |
| `PATH`, `HOME`, `USER`   | 기본 환경                    |
| `TERM`, `LANG`, `LC_ALL` | 터미널/로케일                |
| `GEMINI_API_KEY`         | Gemini 인증 (CI/headless)    |
| `GITHUB_TOKEN`           | GitHub 인증 (CI/headless)    |
| `ANTHROPIC_API_KEY`      | Anthropic 인증 (CI/headless) |

차단되는 변수 예시: `ACO_API_KEY`, `GOOGLE_API_KEY`, `AZURE_OPENAI_KEY`, `COPILOT_TOKEN` 및 그 외 모든 환경 변수.

---

## Node.js 래퍼 책임 (런타임 및 세션)

Node.js 래퍼가 전적으로 담당하는 레이어:

### 1. Provider Runtime (`IProvider`)

각 프로바이더 구현체 (`GeminiProvider`, `CodexProvider`)는 `IProvider` 인터페이스를 구현한다:

- `key`: 프로바이더 키 ("gemini", "codex")
- `installHint`: 설치 안내 메시지
- `isAvailable()`: 바이너리 가용성 체크
- `checkAuth()`: 로컬 credential readiness 휴리스틱 검사
- `buildArgs()`: 인자 구성
- `invoke()`: 프로바이더 프로세스 실행 및 스트리밍 출력

`checkAuth()`는 provider setup UX를 빠르게 만들기 위한 Node.js 래퍼 책임이다. 바이너리 가용성을
먼저 확인한 뒤, 로컬 환경과 인증 파일을 검사하고, 마지막에 provider CLI `--version` 실행으로
폴백한다. 이 fallback은 binary availability 확인이며 remote 인증 검증이 아니다.

| Provider | Fast-path 인증 source                                            | Fallback           |
| -------- | ---------------------------------------------------------------- | ------------------ |
| Gemini   | `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `~/.gemini/oauth_creds.json` | `gemini --version` |
| Codex    | `OPENAI_API_KEY`, `~/.codex/auth.json`                           | `codex --version`  |

Codex의 `~/.codex/auth.json`에 `expires_at` 숫자 값이 있으면 현재 시각과 비교해 만료 여부를
판정한다. 그 외 provider별 remote 인증 성공 여부는 이 fast-path 검사만으로 보장하지 않는다.

### 2. Node Provider Process Environment

Node wrapper의 public `aco run <provider> <command>` 경로는 provider implementation을 통해 외부
CLI를 실행한다. Go runtime의 환경 변수 allowlist는 이 경로에 자동 적용되지 않는다. 사용자용
security model은 Node wrapper 경로와 Go delegate 경로를 분리해 설명해야 한다.

현재 `packages/wrapper`의 provider child process는 별도 `env` override 없이 `spawn()`으로
실행되므로 호출 프로세스의 `process.env`를 상속한다. 따라서 Go delegate runtime의 allowlist
보장을 Node wrapper provider execution에 적용되는 보장처럼 설명하면 안 된다.

### 3. Session Store

예를 들어 `SessionStore`는 `~/.aco/sessions/123e4567-e89b-12d3-a456-426614174000/`
디렉토리에서 다음 파일을 관리한다.

- `task.json`: 태스크 메타데이터
- `output.log`: 프로바이더 출력 로그

### 4. Slash Command Dispatch

`aco run <provider> <command>` 패턴으로 프로바이더를 호출하고, slash command 템플릿에서 위임된 인자를 전달한다.

### 5. Provider Registry

`registry.ts`에서 프로바이더 인스턴스를 등록하고 `getProvider()`로 조회한다.

---

## IProvider 인터페이스 준수

새 프로바이더를 추가할 때는 **양쪽 모두** 동일한 시그니처를 준수해야 한다.

### TypeScript 정의 (`packages/wrapper/src/providers/interface.ts`)

```typescript
export interface IProvider {
  readonly key: string;
  readonly installHint: string;

  isAvailable(): boolean;
  checkAuth(): Promise<AuthResult>;
  buildArgs(command: string, options?: InvokeOptions): string[];
  invoke(
    command: string,
    prompt: string,
    content: string,
    options?: InvokeOptions
  ): AsyncIterable<string>;
}
```

### Go 정의 (`internal/provider/interface.go`)

```go
type Provider interface {
    Name() string           // == TypeScript key
    Binary() string
    IsAvailable() bool
    InstallHint() string    // == TypeScript installHint
    BuildArgs(command, prompt, content string, opts InvokeOpts) []string
    IsAuthFailure(exitCode int, stderr string) bool
    AuthHint() string
    CheckAuth(ctx context.Context) error
}
```

### 준수 요구사항

| 항목           | Go                        | Node.js                    |
| -------------- | ------------------------- | -------------------------- |
| 프로바이더 키  | `Name()`                  | `key` field                |
| 설치 힌트      | `InstallHint()`           | `installHint` field        |
| 인증 체크      | `CheckAuth(ctx)`          | `checkAuth()`              |
| 인자 구성      | `BuildArgs(...) []string` | `buildArgs(...) string[]`  |
| 바이너리명     | `Binary()`                | 각 Provider 내 lookup 호출 |
| 가용성         | `IsAvailable()`           | `isAvailable()`            |
| 인증 실패 분류 | `IsAuthFailure()`         | 없음 (Go만)                |

---

## 환경 변수 Allowlist

Go 바이너리는 호스트의 전체 환경변수 목록에서 **allowlist**에 포함된 변수만 프로바이더 프로세스에 전달한다.

**허용 목록 (Allowlist)**

| Variable                 | 설명                         |
| ------------------------ | ---------------------------- |
| `ACO_TIMEOUT_SECONDS`    | 타임아웃 값 (초 단위)        |
| `PATH`, `HOME`, `USER`   | 기본 환경                    |
| `TERM`, `LANG`, `LC_ALL` | 터미널/로케일                |
| `GEMINI_API_KEY`         | Gemini 인증 (CI/headless)    |
| `GITHUB_TOKEN`           | GitHub 인증 (CI/headless)    |
| `ANTHROPIC_API_KEY`      | Anthropic 인증 (CI/headless) |

**차단 목록 예시 (전달되지 않음)**

- `ACO_API_KEY`, `GOOGLE_API_KEY`, `AZURE_OPENAI_KEY`
- `COPILOT_TOKEN`
- 기타 모든 환경 변수

---

## Contract Drift 방지

### 공유 정의 파일

TypeScript `IProvider` 정의가 canonical 소스이다. Go 인터페이스와 TypeScript 인터페이스 간 불일치를 방지하기 위해:

1. **CI 스크립트** (`scripts/verify-contract.ts`)가 두 인터페이스의 메서드 시그니처를 비교한다.
2. 불일치가 발견되면 CI가 실패한다.

### 파일 경로 검증 규칙

```
allowed:  "foo/bar.md"
allowed:  "/absolute/path/to/file"
blocked:  "../etc/passwd"
blocked:  "foo/../../etc/passwd"
blocked:  "/etc/../../../secret"
```

Go 측 (`cmd_delegate.go`)에서 `filepath.Clean()` + `..` 검사를 수행하며, 검증 실패 시 "invalid file path" 에러를 반환한다.
