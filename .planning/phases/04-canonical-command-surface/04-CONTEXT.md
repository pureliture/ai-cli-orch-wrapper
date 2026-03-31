# Phase 04: Canonical Command Surface - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 이 도구를 발견하고, 실행하고, 잘못된 옛 호출 경로에서 복귀할 때까지
단일 canonical command를 `aco`로 이해하게 만드는 단계다.

이 phase는 설치/진입 이름, help/usage/version 출력, unknown-command 및 stale invocation
복구 메시지처럼 **command surface** 자체를 정리하는 범위다.
repo-local 계약(`.wrapper.json`, `.wrapper/`, `wrapper.lock`) rename과 그에 따른 런타임
경로 정리는 다음 phase에서 다룬다.

</domain>

<decisions>
## Implementation Decisions

### Canonical command name
- **D-01:** 최종 canonical end-user command는 `wrapper`가 아니라 `aco`다.
- **D-02:** Phase 04 범위의 user-facing runtime surface에서는 `wrapper`를 의도적으로 남기지 않는다.
- **D-03:** help, usage, version, unknown-command, stale invocation remediation에서 사용자에게 보이는 이름은 `aco`만 사용한다.

### Public invocation policy
- **D-04:** 지원되는 공식 public invocation path는 `aco` 하나만 둔다.
- **D-05:** `node dist/cli.js` 같은 raw entrypoint는 개발/테스트용 내부 경로로만 취급하고, 일반 사용자 사용 예시로 노출하지 않는다.

### Legacy invocation handling
- **D-06:** `wrapper`를 compatibility alias로 남기지 않는다.
- **D-07:** 사용자가 stale invocation 또는 예전 packaging assumption으로 들어오면 묵시적으로 통과시키지 말고, 명확히 실패시키면서 `aco`를 사용하라고 직접 안내한다.
- **D-08:** 목표는 점진적 병행 운영이 아니라 clean cutover다. Phase 04 범위 안에서는 남아 있는 옛 command naming을 찾아 `aco` 기준으로 치환한다.

### Remediation wording
- **D-09:** 복구 메시지는 짧고 직접적으로 유지한다.
- **D-10:** 복구 메시지에는 정확한 다음 행동 1개만 제시한다. 예시는 상황에 따라 `aco help` 또는 `aco setup` 중 하나를 고른다.

### the agent's Discretion
- stale invocation을 어떤 조건에서 감지할지에 대한 구현 방식
- 에러 상황별로 어떤 단일 next-step example을 붙일지 (`aco help` vs `aco setup`)
- package metadata와 내부 개발자용 설명에서 repo/package identity를 어디까지 유지할지에 대한 비-user-facing 정리 순서

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and success criteria
- `.planning/ROADMAP.md` §Phase 04: Canonical Command Surface — phase goal, success criteria, dependency
- `.planning/REQUIREMENTS.md` — `CMD-01`, `CMD-02`, `WRAP-03` acceptance criteria

### Project intent and constraints
- `.planning/PROJECT.md` §Current Milestone: v1.1 Wrapper Command Consolidation — why the command surface must be locked before wider expansion
- `.planning/PROJECT.md` §Constraints — portability-first principle and wrapper-as-thin-layer constraint
- `.planning/STATE.md` — active milestone, current focus, and discuss-phase checkpoint

### Prior phase foundations
- `.planning/phases/02-cli-aliases-workflow-config/02-CONTEXT.md` — built-ins-first dispatch and repo-local config foundation
- `.planning/phases/03-plan-review-orchestration-loop/03-CONTEXT.md` — workflow command surface and `.wrapper` artifact foundation that Phase 04 must not silently break

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/cli.ts`: help, usage, version, built-in dispatch, and unknown-command handling이 모두 모여 있는 핵심 진입점
- `package.json`: 현재 `bin.wrapper`와 package metadata가 정의된 설치 surface
- `test/alias.test.ts`, `test/workflow-cli.test.ts`: built-ins-first, help/version 문자열, workflow command surface를 잠그는 회귀 테스트 자산

### Established Patterns
- built-in command가 alias/workflow보다 먼저 dispatch된다
- CLI 에러 출력은 짧은 `console.error(...)` 후 `process.exit(1)` 패턴을 사용한다
- `.wrapper.json`과 `.wrapper/workflows`는 이미 prior phase에서 검증된 repo-local 계약이다

### Integration Points
- 설치 및 executable 이름: `package.json`
- command surface 문자열과 remediation: `src/cli.ts`
- setup 안내와 repo-local config bootstrap 힌트: `src/commands/setup.ts`
- 기존 이름 누수 여부를 잡는 regression points: `test/alias.test.ts`, `test/workflow-cli.test.ts`, `README.md`

</code_context>

<specifics>
## Specific Ideas

- 사용자가 고른 새 canonical command는 `aco`
- "기존 wrapper를 남기지 말고, 옛 이름을 모두 찾아서 모두 새로운 이름으로 치환"
- 목표는 gradual migration이 아니라 clean transition이며, 의도적인 legacy alias 보존은 원하지 않음

</specifics>

<deferred>
## Deferred Ideas

- repo-local 계약 rename: `.wrapper.json`, `.wrapper/`, `wrapper.lock`를 `aco` 기준 이름으로 정리하는 작업은 다음 phase의 runtime contract 범위에서 이어서 처리
- command surface 바깥의 광범위한 문서/저장소 identity cleanup은 runtime phases 이후 남는 항목이 있으면 후속 정리 대상으로 추적

</deferred>

---

*Phase: 04-canonical-command-surface*
*Context gathered: 2026-03-31*
