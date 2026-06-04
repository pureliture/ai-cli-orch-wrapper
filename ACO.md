# ACO — AI CLI Orchestration Wrapper

`aco`는 외부 AI CLI에 자문 작업을 위임하는 consent-gated wrapper입니다.
실제 provider를 호출하기 전에 반드시 실행 계획을 미리 확인해야 합니다.

---

## 사용자 진입점 — `/aco` · `$aco` 스킬

**사용자 1차 진입점은 스킬입니다.** `aco` CLI를 직접 치지 않아도 됩니다.

- **Claude Code 세션**: `/aco <자연어 작업>`
- **Codex 세션**: `$aco <자연어 작업>`

스킬이 컨텍스트를 읽어 provider·작업을 결정하고, 실행 계획(dry-run)을 먼저 제시합니다. 계획에 동의하면 실제 위임이 실행되고 결과가 요약 반환됩니다.

### 예시

```
/aco TypeScript 타입 에러 분석해줘
/aco antigravity로 이 PR 리뷰해줘
$aco 현재 브랜치 코드 리뷰 요청
```

> ※ Codex 세션에서 `$aco`를 쓸 때 provider가 `codex`로 지정되면 self-delegation(재귀)이 됩니다. Codex 세션의 peer는 `antigravity`/`mock`입니다. [주의 사항](#주의-사항-caution) 참고.

---

<details>
<summary>aco CLI 직접 실행 — 동의 흐름 (maintainer / 디버그용)</summary>

```bash
# 1단계: 실행 계획 미리보기 (provider 호출 없음)
aco ask --task "TypeScript 타입 에러 분석" --providers antigravity --dry-run

# 2단계: 계획 확인 후 실제 실행
aco ask --task "TypeScript 타입 에러 분석" --providers antigravity --yes
```

`--yes` 없이 실행하면 `Consent required` 안내만 출력하고 종료합니다(인터랙티브 동의 프롬프트는 없습니다).
실행 계획은 `--dry-run`으로 확인하고, 실제 위임은 계획 확인 후 `--yes`로 실행하세요.

</details>

---

## 하부 CLI plumbing 참조 (maintainer / 디버그)

| 커맨드 | 설명 |
|---|---|
| `aco ask` | 작업을 AI provider에 위임 |
| `aco sync` | Claude 구조적 소스(skills, agents)를 Codex 표면(`.agents/skills/`, `.codex/agents/`)으로 동기화 — 가이드라인 markdown(`AGENTS.md`/`GEMINI.md`)은 생성하지 않음 |
| `aco delegate <agent-id>` | `.claude/agents/<agent-id>.md`로 로컬 프롬프트 구성 (외부 호출 없음) |
| `aco doctor` | 환경 및 provider 설정 진단 |
| `aco run <provider> <command>` | provider에 원시 커맨드 직접 전달 |
| `aco result` | 마지막 위임 결과 조회 |
| `aco status` | 진행 중인 위임 작업 상태 확인 |
| `aco cancel` | 진행 중인 작업 취소 |
| `aco pack {install\|uninstall\|status\|setup}` | pack 관리 |
| `aco provider setup <name>` | provider 초기 설정 |

---

## aco ask — 상세 옵션

> 내부 plumbing 옵션입니다. 일반 사용에서는 `/aco` · `$aco` 스킬이 이 옵션들을 자동으로 결정합니다.

```
aco ask --task <text>
        [--providers codex,antigravity,mock]
        [--input <text>]
        [--input-file <path>]
        [--preset <name>]
        [--permission-profile restricted|default|unrestricted]
        [--output-mode brief|save-only|full]
        [--model <model>]
        [--runtime-banner]
        [--host claude|codex]
        [--dry-run | --yes]
```

### 옵션 설명

- `--task` — 위임할 작업 설명 (`--preset` 미사용 시 필수)
- `--providers` — 사용할 provider 목록, 쉼표로 구분
- `--input` / `--input-file` — 추가 컨텍스트 텍스트 또는 파일
- `--preset` — 사전 정의된 설정 프로파일 적용
- `--permission-profile` — `restricted`(기본값) | `default` | `unrestricted`
- `--output-mode` — `brief`(기본값, 전체 출력은 아티팩트로 저장) | `save-only` | `full`
- `--model` — provider가 지원하는 경우 모델 지정
- `--runtime-banner` — 비-TTY 실행에서 런타임 롤업 대시보드를 stdout에 ANSI-free로 1회 출력(host 위임 표시용). `/aco`·`$aco`가 자동으로 부착한다.
- `--host` — 배너 헤더에 표시할 위임 host(`claude` | `codex`). 표시 전용. 미지정 시 legacy generic 헤더(🟠, `Host:` 줄 없음)를 유지하며 값을 빈 채로 전달하면 거부한다. `/aco`는 `claude`, `$aco`는 `codex`를 전달한다.
- `--dry-run` — 실행 계획만 출력, provider 호출 없음
- `--yes` — 동의 프롬프트 없이 즉시 실행

---

## Provider 목록

위임 시 사용할 수 있는 provider (자연어로 지정 가능: "antigravity로 리뷰해줘"):

| Provider | 설명 |
|---|---|
| `codex` | OpenAI Codex CLI |
| `antigravity` | Antigravity (agy) CLI |
| `mock` | 테스트용 mock provider |

**기본(default) provider는 `mock`입니다.** provider를 명시하지 않으면 mock이 사용됩니다.
실제 작업을 위임할 때는 "antigravity로 해줘" 또는 "codex로 해줘"처럼 자연어로 지정하거나, `aco ask`의 `--providers` 플래그를 사용하세요.

---

## aco sync — 구조적 표면 동기화

`aco sync`는 Claude 구조적 소스(`.claude/skills/`, `.claude/agents/`)를 Codex 표면(`.agents/skills/`, `.codex/agents/`)으로 변환합니다.
**가이드라인 markdown(`AGENTS.md`/`GEMINI.md`)은 생성·동기화하지 않습니다** — `AGENTS.md`는 hand-maintained peer 문서이고 `GEMINI.md`는 제거되었습니다.

```bash
aco sync            # Claude skills/agents → Codex 구조적 표면 동기화
aco sync --check    # 스테일 대상 감지 (변경 없음)
aco sync --dry-run  # 변경 사항 미리보기
aco sync --force    # 관리 drift 덮어쓰기 (의도적 강제 동기화)
```

---

## aco delegate — 로컬 에이전트 프롬프트 구성

```bash
aco delegate <agent-id>
```

`.claude/agents/<agent-id>.md`를 읽어 로컬 프롬프트를 구성합니다.
**외부 AI CLI 호출이 없습니다.** 에이전트 정의 파일 기반의 로컬 작업에만 사용됩니다.

---

## 주의 사항 (caution)

### 재귀(self-delegation) 위험

Codex 세션 내부에서 `aco ask --providers codex`를 호출하면 **재귀(self-delegation)** 가 됩니다.
동일 provider를 중첩 호출하는 구조라 컨텍스트 혼선이나 예기치 않은 동작이 생길 수 있습니다.

**권장**: repo 정책상 Codex 세션의 peer는 `antigravity`/`mock`입니다. `--providers antigravity`(또는 다른 peer)로 위임하세요.

```bash
# Codex 세션 내부에서 — 이렇게 하지 마세요
aco ask --task "..." --providers codex   # 재귀 위험

# 대신 peer provider로 위임
aco ask --task "..." --providers antigravity
```

### permission-profile 주의

`--permission-profile unrestricted`는 provider에 광범위한 파일시스템·네트워크 권한을 허용합니다.
신뢰할 수 없는 작업에는 기본값인 `restricted`를 사용하세요.

### --yes 플래그 주의

`--yes`는 동의 절차를 건너뜁니다. 자동화 스크립트에서만 사용하고,
새 작업을 처음 위임할 때는 `--dry-run`으로 계획을 먼저 확인하세요.
