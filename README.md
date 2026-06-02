<!-- ──────────────── HERO BANNER ──────────────── -->
<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12&height=240&section=header&text=ai-cli-orch-wrapper&fontSize=58&fontColor=ffffff&animation=fadeIn&fontAlignY=36&desc=Repo-local%20AI%20workflow%20harness%20for%20Claude%20·%20Codex%20·%20Antigravity&descSize=15&descAlignY=58&descAlign=50" alt="banner" width="100%" />

<br/>

<!-- Project badges -->
<a href="https://www.npmjs.com/package/@pureliture/ai-cli-orch-wrapper">
  <img src="https://img.shields.io/npm/v/@pureliture/ai-cli-orch-wrapper?style=for-the-badge&logo=npm&logoColor=white&color=CB3837&label=npm" alt="npm" />
</a>
<img src="https://img.shields.io/badge/license-MIT-3b82f6?style=for-the-badge" alt="license" />
<img src="https://img.shields.io/badge/node-%E2%89%A518-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="node" />
<img src="https://img.shields.io/badge/PRs-welcome-10b981?style=for-the-badge" alt="prs" />
<img src="https://img.shields.io/badge/OpenSpec-driven-8b5cf6?style=for-the-badge" alt="openspec" />

<br/><br/>

<!-- Tagline -->
<h3>
  <code>Claude</code> · <code>Codex</code> · <code>Antigravity</code>를<br/>
  Claude Code가 감독하고 외부 AI CLI는 advisory로 위임하는 <b>consent-gated AI delegation wrapper</b>입니다.
</h3>

<br/>

<!-- Tech stack -->
<p>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Claude-D97706?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude" />
  <img src="https://img.shields.io/badge/Antigravity-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Antigravity" />
  <img src="https://img.shields.io/badge/OpenAI_Codex-412991?style=for-the-badge&logo=openai&logoColor=white" alt="Codex" />
</p>

<br/>

<!-- Quick navigation -->
<p>
  <a href="#-아키텍처-개요"><img src="https://img.shields.io/badge/🏛️_Architecture-1e293b?style=for-the-badge" alt="Architecture" /></a>
  <a href="#-사용자-가이드"><img src="https://img.shields.io/badge/📖_User_Guide-1e293b?style=for-the-badge" alt="User Guide" /></a>
  <a href="#-사용-시나리오"><img src="https://img.shields.io/badge/🎯_Use_Cases-1e293b?style=for-the-badge" alt="Use Cases" /></a>
  <a href="#-저장소-구조"><img src="https://img.shields.io/badge/🗂️_Repo_Layout-1e293b?style=for-the-badge" alt="Repo Layout" /></a>
  <a href="#%EF%B8%8F-하네스-구성"><img src="https://img.shields.io/badge/🛠️_Harness-1e293b?style=for-the-badge" alt="Harness" /></a>
</p>

</div>

<br/>

<!-- ────────────── SECTION DIVIDER ────────────── -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=12&height=3" width="100%" />

<br/>

## 🏛️ 아키텍처 개요

> command pack 설치, Claude 기준 자산의 Codex/Antigravity target sync, provider 실행, session-aware
> `result/status/cancel` — 외부 AI CLI를 **하나의 반복 가능한 개발 워크플로우**로 묶는 것이 목표입니다.

용어 기준: provider invocation, run/session artifacts, briefs, advisory output은
[Ubiquitous Language](docs/reference/ubiquitous-language.md)에 정의되어 있습니다.

<p align="center">
  <img src="docs/images/architecture-overview.svg" alt="System Architecture" width="100%" />
</p>

<br/>

### 🎨 핵심 설계 포인트

<table>
<tr>
<td width="50%" valign="top">

#### 🟣 Harness / Generated 분리

`.claude/`는 **사람이 관리하는 기준 자산**.<br/>
Codex·Antigravity 대상 파일은 생성 산출물로 관리되어 운영 중 수동 수정과 자동 생성의 경계가 분명합니다.

</td>
<td width="50%" valign="top">

#### 🔵 Provider Abstraction

동일한 `aco` 진입점에서<br/>
**Antigravity · Codex별 실행 차이를 흡수**합니다.<br/>
새 provider 추가는 `IProvider` 구현 + registry 등록으로 끝납니다.

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 🟢 Session-Aware Operations

`aco status`, `aco result`, `aco cancel`로<br/>
**실행 상태를 운영 명령으로 노출**합니다.<br/>
모든 실행은 `~/.aco/sessions/`에 보존됩니다.

</td>
<td width="50%" valign="top">

#### 🟠 Node + Go 이중 실행

**Node wrapper**는 공개 npm UX를,<br/>
**Go runtime**은 blocking provider 실행 실험을 담당합니다.<br/>
책임 경계가 문서·구현 양쪽에서 분리됩니다.

</td>
</tr>
</table>

<br/>

### 🔄 Context 동기화 흐름

<p align="center">
  <img src="docs/images/context-sync.svg" alt="Context Sync Flow" width="100%" />
</p>

> 💡 `aco sync`는 **default-deny** 정책으로 동작합니다. `.claude/skills/` 전체를 복사하지 않고
> 명시적으로 허용된 ACO-owned 공유 skill만 `.agents/skills/`에 동기화합니다.
> 자세한 변환 규칙은 [docs/reference/context-sync.md](docs/reference/context-sync.md)를 참고합니다.

<br/>

<!-- ────────────── SECTION DIVIDER ────────────── -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=12&height=3" width="100%" />

<br/>

## 📖 사용자 가이드

### ⚡ 요구사항

<table>
<thead>
<tr>
<th>의존성</th><th>필수 여부</th><th>용도</th><th>설치</th>
</tr>
</thead>
<tbody>
<tr>
<td><img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" /></td>
<td>✅ 필수</td>
<td>npm workspace 및 공개 npm CLI 실행</td>
<td><code>≥ 18.x</code></td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Claude_Code-D97706?style=flat-square&logo=anthropic&logoColor=white" /></td>
<td>✅ 필수</td>
<td>repo-local command pack 기준 실행</td>
<td>Anthropic 공식 CLI</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Antigravity_CLI-4285F4?style=flat-square&logo=google&logoColor=white" /></td>
<td>🟡 Provider별</td>
<td>Antigravity provider 사용 시</td>
<td><code>curl -fsSL https://antigravity.google/cli/install.sh | bash</code></td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Codex_CLI-412991?style=flat-square&logo=openai&logoColor=white" /></td>
<td>🟡 Provider별</td>
<td>Codex provider 사용 시</td>
<td><code>npm i -g @openai/codex</code></td>
</tr>
</tbody>
</table>

<br/>

### 🚀 설치

<details open>
<summary><b>방법 1 — published npm package 사용</b></summary>

```bash
npx @pureliture/ai-cli-orch-wrapper pack setup
npx @pureliture/ai-cli-orch-wrapper provider setup antigravity
npx @pureliture/ai-cli-orch-wrapper provider setup codex
```

</details>

<details>
<summary><b>방법 2 — local tarball로 설치 검증</b></summary>

```bash
npm install
npm run build --workspace=packages/wrapper
npm pack --workspace=packages/wrapper --pack-destination /tmp/aco-pack
npm install -g /tmp/aco-pack/pureliture-ai-cli-orch-wrapper-<version>.tgz
aco pack setup
```

</details>

<details>
<summary><b>방법 3 — 저장소 checkout에서 직접 실행 (최신 source)</b></summary>

```bash
npm install
npm run build --workspace=packages/wrapper
node packages/wrapper/dist/cli.js pack setup
node packages/wrapper/dist/cli.js provider setup antigravity
node packages/wrapper/dist/cli.js sync --check
```

</details>

`aco pack setup`은 `.claude/commands`, `.claude/aco/prompts`, `.claude/aco/tasks`를 설치한다.
패키지에 포함된 task preset은 `review`, `spec-critique`, `plan-critique`, `tdd`,
`code-simplify`, `default`이며, provider 실행 없이 다음처럼 확인할 수 있다.
설치 후 sync가 실패하면 출력된 manifest 경로를 확인하고 setup에 사용한 것과 같은
entrypoint로 `pack uninstall`을 실행한다. `--global`로 설치했다면 복구 명령도
`pack uninstall --global`이어야 한다.

```bash
aco ask --preset review --dry-run
aco ask --preset spec-critique --dry-run
aco ask --preset plan-critique --dry-run
aco ask --preset tdd --dry-run
```

설치 후 버전 확인:

```bash
aco --version
# 또는
npx @pureliture/ai-cli-orch-wrapper --version
```

<br/>

### 🔧 Provider 설정

<table>
<thead>
<tr>
<th align="center">Provider</th>
<th>외부 CLI 설치</th>
<th>인증 소스</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><img src="https://img.shields.io/badge/Antigravity-4285F4?style=for-the-badge&logo=google&logoColor=white" /></td>
<td><code>curl -fsSL https://antigravity.google/cli/install.sh | bash</code></td>
<td>OS Keyring (no API key env required)</td>
</tr>
<tr>
<td align="center"><img src="https://img.shields.io/badge/Codex-412991?style=for-the-badge&logo=openai&logoColor=white" /></td>
<td><code>npm install -g @openai/codex</code></td>
<td><code>OPENAI_API_KEY</code> · <code>~/.codex/auth.json</code></td>
</tr>
</tbody>
</table>

```bash
# provider CLI와 local credential readiness 확인
aco provider setup antigravity
aco provider setup codex
```

> ⚠️ **Headless / CI 환경 주의사항**
>
> - Antigravity: OS Keyring 기반 인증. API key 환경변수 불필요. `-m`/`--cwd` 플래그 미지원
> - Codex: `OPENAI_API_KEY` 또는 OAuth. 토큰 만료 시 `codex login` 재실행

<br/>

### 📊 CLI 명령 참조

<table>
<thead>
<tr>
<th align="center">그룹</th>
<th>명령</th>
<th>목적</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><img src="https://img.shields.io/badge/📦-Pack-8b5cf6?style=for-the-badge" /></td>
<td><code>aco pack install</code><br/><code>aco pack setup</code><br/><code>aco pack status</code></td>
<td>Claude command pack 설치·설정·상태 확인</td>
</tr>
<tr>
<td align="center"><img src="https://img.shields.io/badge/🔌-Provider-3b82f6?style=for-the-badge" /></td>
<td><code>aco provider setup &lt;name&gt;</code></td>
<td>provider CLI · credential readiness 확인</td>
</tr>
<tr>
<td align="center"><img src="https://img.shields.io/badge/🧭-Ask-0f766e?style=for-the-badge" /></td>
<td><code>aco ask --task "..." --dry-run</code><br/><code>aco ask --providers mock --task "..." --yes</code></td>
<td>동의 기반 외부 AI 위임 · bounded brief 반환</td>
</tr>
<tr>
<td align="center"><img src="https://img.shields.io/badge/🔄-Sync-06b6d4?style=for-the-badge" /></td>
<td><code>aco sync --check</code><br/><code>aco sync --force</code></td>
<td>Codex/Antigravity target drift 확인 및 갱신</td>
</tr>
<tr>
<td align="center"><img src="https://img.shields.io/badge/▶️-Run-10b981?style=for-the-badge" /></td>
<td><code>aco run antigravity review</code><br/><code>aco run codex review</code></td>
<td>provider command 실행 · session 생성</td>
</tr>
<tr>
<td align="center"><img src="https://img.shields.io/badge/🩺-Doctor-f97316?style=for-the-badge" /></td>
<td><code>aco doctor</code></td>
<td>local-only 환경 · harness · provider readiness 진단</td>
</tr>
<tr>
<td align="center"><img src="https://img.shields.io/badge/💾-Session-0d9488?style=for-the-badge" /></td>
<td><code>aco status</code><br/><code>aco result</code><br/><code>aco cancel --session &lt;id&gt;</code></td>
<td>session 상태 · 결과 · 취소</td>
</tr>
</tbody>
</table>

`aco doctor`는 local-only 진단 명령입니다. Node/aco version, git repo, `.claude` harness, generic
`/aco` command, `aco-delegation` skill, provider availability, local credential readiness heuristic,
sync drift 상태를 확인하지만 real provider execution이나 remote auth verification은 수행하지 않습니다.

### 🧭 Consent-Gated Delegation

`aco ask`는 Claude Code 세션 안에서 외부 AI CLI에 advisory 작업을 맡기기 위한 high-level
wrapper입니다. provider 실행은 명시적 동의 없이는 시작되지 않습니다.

<p align="center">
  <img src="docs/images/session-lifecycle.svg" alt="Delegation Lifecycle" width="100%" />
</p>

> 💡 `--dry-run`은 실행 계획만 표시하고 provider를 호출하지 않습니다. 실제 위임은 `--yes`로
> 명시 동의했을 때만 시작되며, 그 시점에 session이 생성되고 ledger·brief·output이 기록됩니다.

```bash
# 실행 계획만 확인하고 provider는 호출하지 않음
aco ask --providers mock --task "review this demo input" --input "demo" --dry-run

# 명시 동의 후 실행. full output은 session artifact에 저장되고 stdout에는 brief만 출력
aco ask --providers mock --task "review this demo input" --input "demo" --yes --output-mode brief

# 저장된 full output 조회
aco result

# local harness/provider readiness 점검. 네트워크나 real provider 호출 없음
aco doctor
```

기본값은 `--permission-profile restricted`와 `--output-mode brief`입니다. `--output-mode full`은
사용자가 현재 Claude Code 세션에 provider raw output을 직접 넣고 싶을 때만 명시적으로 사용합니다.
`brief`는 provider별 600자 bounded summary만 stdout에 포함하고, full output은 artifact에 저장합니다.
`mock` provider는 인증 없는 deterministic demo 전용이며, 실제 AI 품질을 의미하지 않습니다.

### aco ask vs aco delegate

| 커맨드 | 용도 | 방향 |
|--------|------|------|
| `aco ask` | 외부 AI provider(Gemini, Codex)에 advisory 작업을 위임 | Claude Code → 외부 AI CLI |
| `aco delegate` | 명명된 agent spec과 seed 파일로 풍부한 프롬프트를 구성해 stdout에 출력 | Claude Code 세션 내 재사용 |

`aco ask`는 동의 게이트를 통해 외부 provider를 실제로 호출하고 결과를 artifact에 저장합니다.
`aco delegate`는 외부 호출 없이 `.claude/agents/<agent-id>.md`의 spec과 `promptSeedFile`의 seed
내용을 결합해 stdout에 출력합니다. `/review`, `/research`, `/execute` 같은 slash command에서
`aco delegate <agent-id> --input "$PROMPT"` 형태로 호출해 Claude Code 세션 안에서 사용합니다.

```bash
# agent spec과 seed를 결합한 프롬프트를 stdout에 출력
aco delegate reviewer --input "$(git diff HEAD)"

# input 내용을 파일에서 읽기
aco delegate researcher --input-file context.txt
```

<details>
<summary>📺 <b>Runtime Session 대시보드 예시</b> (펼치기)</summary>

`aco run` 실행 시 stderr에 출력되는 대시보드:

```text
🛰️  aco Runtime Session

✨ Active
  Provider:   antigravity
  Command:    review
  Session ID: f3f2d9...b1
  Auth:       ready (keyring)
  Branch:     main

🧩 Exposed
  Providers:  antigravity
  Agents:     reviewer, planner
  Hooks:      PostToolUse
  Skills:     review-skill
```

</details>

<br/>

<!-- ────────────── SECTION DIVIDER ────────────── -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=12&height=3" width="100%" />

<br/>

## 🎯 사용 시나리오

<table>
<thead>
<tr>
<th align="center" width="33%">
<img src="https://img.shields.io/badge/🚀_시나리오_1-새_저장소_셋업-8b5cf6?style=for-the-badge" />
</th>
<th align="center" width="33%">
<img src="https://img.shields.io/badge/🔍_시나리오_2-Multi--Provider_리뷰-3b82f6?style=for-the-badge" />
</th>
<th align="center" width="33%">
<img src="https://img.shields.io/badge/📊_시나리오_3-세션_추적-0d9488?style=for-the-badge" />
</th>
</tr>
</thead>
<tbody>
<tr>
<td valign="top">

**🎬 상황**
AI CLI workflow를 처음 도입하는 저장소

**📋 단계**

```diff
+ ① 패키지 설치
  npx @pureliture/ai-cli-orch-wrapper pack setup

+ ② provider 설정
  aco provider setup antigravity

+ ③ context sync 상태 확인
  aco sync --check

+ ④ 첫 실행
  aco run antigravity review

+ ⑤ 결과 확인
  aco result
```

**✨ 결과**
`~/.aco/sessions/`에 session 로그 생성, `AGENTS.md` 자동 생성

</td>
<td valign="top">

**🎬 상황**
PR 머지 전 Antigravity와 Codex **양쪽 리뷰**를 받고 싶을 때

**📋 단계**

```diff
+ ① Antigravity 리뷰 실행
  aco run antigravity review

+ ② session ID 메모
  aco status

+ ③ Codex 리뷰 실행
  aco run codex review

+ ④ 각 결과 조회
  aco result --session <id>

+ ⑤ follow-up 작업 생성
  /gh-pr-followup
```

**✨ 결과**
두 provider의 advisory output을 각각 session으로 보존, human review 보조

</td>
<td valign="top">

**🎬 상황**
실행 중인 작업의 상태를 확인하거나 취소해야 할 때

**📋 단계**

```diff
+ ① 전체 세션 목록 확인
  aco status

+ ② 특정 세션 상세 확인
  aco status --session <id>

+ ③ 결과 출력
  aco result --session <id>

+ ④ 실행 중 작업 취소
  aco cancel --session <id>
```

**✨ 결과**
`task.json` · `output.log` 기반으로 모든 session 이력 추적 가능

</td>
</tr>
</tbody>
</table>

<br/>

<!-- ────────────── SECTION DIVIDER ────────────── -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=12&height=3" width="100%" />

<br/>

## 🗂️ 저장소 구조

이 저장소는 npm workspace이며, Node wrapper와 Go runtime이 한 트리에 공존합니다.

<p align="center">
  <img src="docs/images/repository-structure.svg" alt="Repository Structure" width="100%" />
</p>

<table>
<thead>
<tr><th>경로</th><th>역할</th></tr>
</thead>
<tbody>
<tr>
<td><code>packages/wrapper/</code></td>
<td><code>@pureliture/ai-cli-orch-wrapper</code> 런타임 — <code>aco</code> CLI, provider interface·구현·registry, sync engine, session/task/output lifecycle</td>
</tr>
<tr>
<td><code>packages/installer/</code></td>
<td>install-time entrypoint와 setup flow</td>
</tr>
<tr>
<td><code>cmd/aco/</code> · <code>internal/</code></td>
<td>Go runtime — blocking provider 실행 실험(<code>delegate</code> · <code>run</code>)과 provider·runner 내부 구현</td>
</tr>
<tr>
<td><code>templates/commands/</code> · <code>templates/prompts/</code> · <code>templates/tasks/</code></td>
<td>command pack에 포함되어 배포되는 slash command·prompt·task preset 소스</td>
</tr>
<tr>
<td><code>docs/</code></td>
<td>architecture, contract, guides, reference, phase plan, archive 문서</td>
</tr>
<tr>
<td><code>openspec/</code></td>
<td>OpenSpec proposal·spec·design·task 목록</td>
</tr>
<tr>
<td><code>.github/workflows/</code></td>
<td><code>ci.yml</code> · <code>release.yml</code> 등 CI/릴리스 워크플로우</td>
</tr>
</tbody>
</table>

> 💡 `Go runtime`은 별도 디렉터리가 아니라 root의 <code>cmd/aco/</code>와 <code>internal/</code>을 묶은
> 개념적 그룹입니다. Node/Go 책임 경계는 [docs/contract/go-node-boundary.md](docs/contract/go-node-boundary.md)에 정의되어 있습니다.

<br/>

<!-- ────────────── SECTION DIVIDER ────────────── -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=12&height=3" width="100%" />

<br/>

## 🛠️ 하네스 구성

이 저장소는 repo-local `.claude/`를 **harness 기준**으로 사용합니다.

<table>
<tr>
<td width="50%" valign="top">

### 🟣 Source Surface (hand-maintained)

```
.claude/
├── 📁 agents/         # Claude Code agent definitions
├── 📁 commands/       # Slash commands used by this repo
├── 📁 skills/         # Local workflow skills
├── 📁 aco/
│   └── prompts/       # Provider prompt templates
├── ⚙️ settings.json   # Shared Claude Code settings
└── ⚙️ settings.local.json  # Local-only (gitignored)
```

> **사람이 직접 관리하는 영역**<br/>
> 이 파일들이 모든 변환의 source of truth입니다.

</td>
<td width="50%" valign="top">

### ⚪ Generated Targets (managed by `aco sync`)

```
📄 AGENTS.md               # Codex 프로젝트 지침
📁 .agents/skills/         # Codex·Antigravity 공유 (ACO-owned only)
📁 .codex/agents/          # Codex custom agent
🗂️ .aco/sync-manifest.json  # Drift tracking
```

> **`aco sync`가 관리하는 영역**<br/>
> 수동 편집 시 drift 경고가 발생합니다.

Hook 설정은 provider별 user-level runtime 설정으로 취급하며 `aco sync`가 생성하지 않습니다.

</td>
</tr>
</table>

### 🔄 Sync 명령 패턴

```bash
# ① 읽기 전용 — drift 여부만 확인 (변경 없음)
aco sync --check

# ② CI 모드 — 중복 경고 포함, strict 검증
aco sync --check --strict

# ③ 의도적 갱신 — generated target을 다시 생성
aco sync --force
```

자세한 운영 규칙은 [docs/reference/context-sync.md](docs/reference/context-sync.md)와
[docs/guides/runbook.md](docs/guides/runbook.md)를 참고합니다.

<br/>

<!-- ────────────── SECTION DIVIDER ────────────── -->
<img src="https://capsule-render.vercel.app/api?type=rect&color=gradient&customColorList=12&height=3" width="100%" />

<br/>

## ✅ 현재 구현 범위

<table>
<thead>
<tr>
<th align="center">상태</th>
<th>영역</th>
<th>가능한 일</th>
<th>대표 명령</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center">🟢</td>
<td><b>Command pack</b></td>
<td>Claude slash command pack 설치·갱신·상태 확인</td>
<td><code>aco pack setup</code></td>
</tr>
<tr>
<td align="center">🟢</td>
<td><b>Context sync</b></td>
<td>Claude 자산을 Codex/Antigravity target으로 동기화·drift 확인</td>
<td><code>aco sync --check</code></td>
</tr>
<tr>
<td align="center">🟢</td>
<td><b>Provider setup</b></td>
<td>Antigravity/Codex CLI · credential readiness 확인</td>
<td><code>aco provider setup &lt;name&gt;</code></td>
</tr>
<tr>
<td align="center">🟢</td>
<td><b>Provider invocation</b></td>
<td>provider별 command 실행 · session 생성</td>
<td><code>aco run antigravity review</code></td>
</tr>
<tr>
<td align="center">🟢</td>
<td><b>Session ops</b></td>
<td>실행 상태 · 결과 · 취소</td>
<td><code>aco status</code></td>
</tr>
<tr>
<td align="center">🟢</td>
<td><b>Mock provider</b></td>
<td>인증 없는 demo · CI 검증</td>
<td><code>aco ask --providers mock</code></td>
</tr>
<tr>
<td align="center">🟢</td>
<td><b>aco doctor</b></td>
<td>local-only 환경 헬스체크 v1</td>
<td><code>aco doctor</code></td>
</tr>
<tr>
<td align="center">🟢</td>
<td><b>Run/session artifact v1</b></td>
<td>ledger · brief · input · prompt · output · error log</td>
<td><code>aco result</code></td>
</tr>
</tbody>
</table>

<br/>

## 🧰 개발

```bash
npm install
npm run build
npm test
npm run typecheck
```

harness 동기화 동작을 바꿀 때 추가 확인:

```bash
npm run test:fixtures
npm run test:pack-runtime-contract --workspace=packages/wrapper
npm run test:smoke
git diff --check
aco sync --check
```

커밋 메시지 템플릿 설정:

```bash
git config commit.template .gitmessage
```

- 📄 Template: [.gitmessage](.gitmessage)
- 💬 Prompt: [docs/guides/commit-message-prompt.md](docs/guides/commit-message-prompt.md)

<br/>

## ❓ 문제 해결

<details>
<summary><code>aco: command not found</code></summary>

```bash
npm run build --workspace=packages/wrapper
node packages/wrapper/dist/cli.js --version
# published package만 사용할 때
npx @pureliture/ai-cli-orch-wrapper --version
```

</details>

<details>
<summary>Provider를 찾을 수 없거나 인증되지 않은 경우</summary>

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
npm install -g @openai/codex
aco provider setup antigravity
aco provider setup codex
```

Codex OAuth 토큰 만료 시: `codex login` 재실행<br/>
Headless/CI 환경: Antigravity는 OS Keyring 사용. Codex는 `OPENAI_API_KEY` 환경변수 설정

</details>

<details>
<summary>slash command가 보이지 않는 경우</summary>

```bash
aco pack status
aco pack setup
```

</details>

<details>
<summary>Codex/Antigravity target surface가 stale해 보이는 경우</summary>

```bash
# 읽기 전용 drift 확인 (변경 없음)
aco sync --check
# 또는 source checkout에서
node packages/wrapper/dist/cli.js sync --check
```

</details>

<br/>

## 📚 문서

<table>
<thead>
<tr>
<th>문서</th><th>언제 참고</th>
</tr>
</thead>
<tbody>
<tr>
<td>🔐 <a href="docs/security.md"><b>Security Model</b></a></td>
<td>consent gate, token-saving output modes, artifacts, secrets policy를 확인할 때</td>
</tr>
<tr>
<td>💾 <a href="docs/reference/session-artifacts.md"><b>Session Artifacts</b></a></td>
<td><code>~/.aco/runs</code>와 <code>~/.aco/sessions</code> layout을 확인할 때</td>
</tr>
<tr>
<td>📌 <a href="docs/case-study.md"><b>Case Study</b></a></td>
<td>문제 배경, 제약, 설계 선택, 현재 한계를 빠르게 파악할 때</td>
</tr>
<tr>
<td>🏛️ <a href="docs/architecture.md"><b>Architecture</b></a></td>
<td>wrapper, sync engine, provider runtime 구조를 자세히 볼 때</td>
</tr>
<tr>
<td>🔄 <a href="docs/reference/context-sync.md"><b>Context Sync Reference</b></a></td>
<td>managed output, manifest, drift 처리 규칙을 확인할 때</td>
</tr>
<tr>
<td>🗺️ <a href="docs/roadmap.md"><b>Roadmap</b></a></td>
<td>planned work와 구현 우선순위를 확인할 때</td>
</tr>
<tr>
<td>🚦 <a href="docs/guides/github-workflow.md"><b>GitHub Workflow</b></a></td>
<td>issue, branch, PR, Project board 운영 방식을 따를 때</td>
</tr>
<tr>
<td>🤝 <a href="docs/guides/contributing.md"><b>Contributing</b></a></td>
<td>개발 환경, 검증, 변경 제출 규칙을 확인할 때</td>
</tr>
<tr>
<td>🚑 <a href="docs/guides/runbook.md"><b>Runbook</b></a></td>
<td>운영 중 실패나 복구 절차를 볼 때</td>
</tr>
</tbody>
</table>

전체 목차: [docs/README.md](docs/README.md)

<br/>

<!-- ────────────── FOOTER ────────────── -->

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12&height=120&section=footer" width="100%" />

<sub>Made by <a href="https://github.com/pureliture">@pureliture</a> · Built on <code>OpenSpec</code> · Powered by <code>Claude Code</code></sub>

</div>
