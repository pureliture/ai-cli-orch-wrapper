# Architecture

## 배경

기존 구조는 `.claude/commands/`와 `.claude/aco/lib/adapter.sh`를 레포에 직접 커밋한 "레포-로컬 bash command pack"이었다. 각 slash command는 상대경로로 `adapter.sh`를 `source`하고 `gemini` / `copilot` CLI를 직접 실행했다. 설치 단계가 없어 레포를 이동하면 깨지고, 버전 관리나 다른 프로젝트 재사용이 불가능했다.

## 현재 구조

```
packages/
  wrapper/     # @aco/wrapper — provider 기반 Node.js 런타임
  installer/   # aco-install — npx 설치 CLI
templates/
  commands/    # slash command 템플릿 (설치 시 .claude/commands/ 로 복사)
  prompts/     # provider별 프롬프트 템플릿
```

## 핵심 설계 결정

### D1: npm workspace 모노레포

`packages/wrapper`와 `packages/installer`는 별도 publish 라이프사이클을 가진다. workspace로 묶어 registry 없이 타입을 공유한다.

빌드 순서는 명시적으로 고정:
```
npm run build --workspace=packages/wrapper
→ npm run build --workspace=packages/installer
```
installer가 wrapper의 `dist/`를 참조하므로 wrapper를 먼저 빌드해야 한다.

### D2: slash command → wrapper subprocess

slash command 마크다운은 `aco run <provider> <command>` 한 줄만 호출한다. wrapper가 이후 실행 전체를 담당한다.

### D3: `IProvider` 인터페이스

```ts
interface IProvider {
  key: string;
  isAvailable(): boolean;
  checkAuth(): Promise<AuthResult>;
  buildArgs(command: string, options: InvokeOptions): string[];
  invoke(prompt: string, content: string, options: InvokeOptions): AsyncIterable<string>;
}
```

새 provider 추가는 이 인터페이스를 구현하는 파일 하나면 충분하다.

### D4: session/task/output lifecycle

wrapper가 `~/.aco/sessions/<uuid>/` 디렉터리를 관리한다:
- `task.json` — status, provider, command, pid, timestamps
- `output.log` — 스트리밍 출력
- `error.log` — 에러 로그

`aco result`, `aco status`, `aco cancel`은 이 디렉터리를 읽는다.

### D5: 설치 = 파일 복사

`aco pack install`은 `templates/commands/` → `.claude/commands/` 로 파일을 복사한다. symlink는 nvm/fnm 버전 전환 시 깨지므로 사용하지 않는다.

## 설치 UX 분리

| 명령 | 역할 |
|------|------|
| `aco pack install` | command 템플릿 + 프롬프트 복사 |
| `aco pack setup` | install + provider 상태 확인 |
| `aco provider setup <name>` | 해당 provider CLI 설치 및 인증 안내 |

pack 설치와 provider CLI 설치를 분리해 각각 독립적으로 관리할 수 있다.

## 권한 프로파일

`aco run --permission-profile <default|restricted|unrestricted>`

`restricted` 모드는 현재 경고 로그만 출력한다. OS 레벨 샌드박싱은 v1 범위 밖이다.

## 향후 확장

- 새 provider: `IProvider` 구현체 추가 + `ProviderRegistry.register()` 호출
- `aco run --background`: 백그라운드 실행 후 session ID 반환 (현재 미구현)
- `aco pack update`: 설치된 pack 버전 잠금 파일 관리
