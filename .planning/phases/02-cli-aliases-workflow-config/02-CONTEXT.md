# Phase 2: CLI Aliases + Workflow Config - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

`wrapper <alias>` CLI 커맨드 추가 및 `.wrapper.yaml` 설정 파일 구조 정의.
사용자가 `wrapper claude`, `wrapper gemini` 등 짧은 alias로 `cao launch`를 호출할 수 있게 하고,
alias→provider 매핑 및 role→provider 매핑(Phase 3용)을 설정 파일로 관리.

orchestration 루프(plan→review 반복) 실행은 Phase 3 범위.

</domain>

<decisions>
## Implementation Decisions

### Config 파일 위치 및 포맷
- **D-01:** Config 파일은 `.wrapper.yaml` — 프로젝트 루트에 위치하며 레포에 커밋. 이식성 우선 원칙에 직접 부합.
- **D-02:** Global config (`~/.config/...`) 없음 — 레포가 전체 환경 상태를 담는다는 원칙 유지.
- **D-03:** Config 파일 직렬화 포맷 — 프로젝트 zero production dependency 원칙 고려 필요. YAML은 `js-yaml` 런타임 dep 추가 필요; JSON은 dep 없이 구현 가능. 사용자 가독성(YAML) vs 제로 dep(JSON) 중 선택은 Claude's Discretion (하단 참조).

### Alias 동작
- **D-04:** `wrapper <alias>` 는 `cao launch --provider <provider> --agents <agent>` 를 실행. cao 자체가 tmux 세션을 생성·관리.
- **D-05:** alias 뒤에 오는 추가 인자는 전체 cao에 passthrough. 예: `wrapper claude --session-name my-task` → `cao launch --provider claude_code --agents developer --session-name my-task`.
- **D-06:** wrapper는 tmux 세션을 직접 관리하지 않음 — cao에 위임.

### tmux conf 비변경
- **D-07:** Phase 2에서 `~/.config/tmux/ai-cli.conf` 를 수정하지 않음. Phase 1이 작성한 placeholder comment("Phase 2 will populate CLI alias bindings here")는 현실에 맞게 업데이트 필요.
- **D-08:** `wrapper setup` 재실행 시 `ai-cli.conf` 가 이미 존재하면 Phase 1과 동일하게 건드리지 않음. tmux 키 바인딩은 현재 계획 범위 밖.

### Config 스키마
- **D-09:** `.wrapper.yaml`은 두 섹션을 가짐 — `aliases`(Phase 2)와 `roles`(Phase 3용).
- **D-10:** alias 항목은 `provider`(cao --provider 값)와 `agent`(cao --agents 값) 두 필드.
- **D-11:** `roles` 섹션은 Phase 2에서 파일에 선언만 하고 Phase 3에서 실제 사용. Phase 3가 이 파일을 그대로 읽으면 됨.

  표준 스키마:
  ```yaml
  aliases:
    claude:
      provider: claude_code
      agent: developer
    gemini:
      provider: gemini_cli
      agent: developer
    codex:
      provider: codex
      agent: developer

  roles:
    orchestrator: claude_code
    reviewer: gemini_cli
  ```

### Claude's Discretion
- **Config 직렬화 포맷:** YAML(가독성, js-yaml dep 추가) vs JSON(zero dep 유지, 가독성 낮음). 제로 dep 원칙을 엄격히 지키려면 JSON 또는 간단한 YAML subset 직접 파싱. js-yaml 추가가 허용된다고 판단되면 YAML 사용.
- `wrapper <unknown-alias>` 입력 시 에러 메시지 포맷 (Phase 1 패턴 따름: `console.error` + `process.exit(1)`).
- `cli.ts`의 동적 alias 라우팅 구현 방식 (정적 if/else → alias 목록 루프 방식으로 변경 필요).
- `.wrapper.yaml`이 없을 때 동작 — 에러 vs 빈 alias 목록으로 graceful fallback.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — ALIAS-01, ALIAS-02, CONFIG-01, CONFIG-02, CONFIG-03 정의. Phase 2 완료 기준.

### Project constraints
- `.planning/PROJECT.md` §Constraints — 이식성 우선, tmux conf 비침습, registry 결합 금지.

### cao CLI
- `cao launch --help` — `--agents`, `--provider`, `--session-name`, `--headless` 플래그 확인 필수. alias passthrough 구현의 기반.
- `cao flow --help` — Phase 3 scope이지만 Phase 2 config 스키마가 Phase 3와 호환되는지 확인용.

No external specs — requirements are fully captured in decisions above and in REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/commands/setup.ts` — `setupCommand()` 패턴 그대로 따름. `src/commands/alias.ts` 를 동일 구조로 작성.
- `src/cli.ts` 디스패치 테이블 — 현재 정적 if/else. Phase 2에서 `.wrapper.yaml` alias 목록을 읽어 동적 라우팅으로 확장 필요.

### Established Patterns
- 커맨드 핸들러: `src/commands/<name>.ts`, named export `<name>Command(): Promise<void>`
- 출력: `console.log('[✓] ...')` 성공, `console.error('Error: ...')` 실패 후 `process.exit(1)`
- Zero runtime dependencies — config 파싱 시 dep 추가 여부 결정 필요 (D-03 참조)
- NodeNext 모듈, `.js` 확장자 명시 필수, `import type` for type-only imports

### Integration Points
- `src/cli.ts` — alias 라우팅 추가: 첫 번째 arg가 `.wrapper.yaml`의 alias 키와 일치하면 `aliasCommand(name, remainingArgs)` 호출
- `src/commands/setup.ts` — `AI_CLI_CONF_CONTENT` 상수의 주석 문구 수정 (D-07)
- `.wrapper.yaml` — Phase 2에서 새로 생성, `wrapper setup` 실행 시 파일 없으면 기본 예시 파일 생성할지 여부도 결정 포인트

</code_context>

<specifics>
## Specific Ideas

- cao 확인 결과: `cao launch --agents developer --provider claude_code` 가 실제 실행 형식. `--agents` 는 필수 파라미터.
- `.wrapper.yaml`의 `agent` 기본값은 `developer` (cao built-in 프로파일). 사용자가 커스텀 프로파일 설치 후 변경 가능.
- "wrapper는 role이랑 모델을 지정해서 cao를 실행시켜주는 역할" — 사용자 확인된 핵심 가치 요약.

</specifics>

<deferred>
## Deferred Ideas

- tmux 키 바인딩 생성 (`bind-key C run-shell "wrapper claude"`) — 현재 계획 외, 필요성 없음
- workmux 기반 worktree 작업 환경 생성 (`wrapper worktree`) — v2 scope (REQUIREMENTS.md WORK-01)
- Global config (`~/.config/...`) — 불필요, per-repo으로 충분

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-cli-aliases-workflow-config*
*Context gathered: 2026-03-24*
