# Phase 3: Plan→Review Orchestration Loop - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 두 AI CLI 사이의 plan→review 반복 루프를 실행할 수 있어야 한다.
이 phase는 planner CLI가 plan artifact를 만들고 reviewer CLI가 그 artifact를 읽어 review artifact를 남기며,
reviewer가 승인하거나 최대 iteration에 도달할 때까지 루프를 반복하는 실행 흐름을 제공한다.

Phase 2에서 도입된 alias/role config를 실제 workflow 실행에 연결하는 것이 범위다.
새 wrapper DSL을 만드는 것은 범위 밖이며, cao native provider/role 개념을 유지한다.

</domain>

<decisions>
## Implementation Decisions

### Workflow entry model
- **D-01:** Phase 3는 **predefined named workflow**를 기본 경로로 지원한다. 사용자는 config에 workflow를 정의해두고 그 이름으로 실행한다.
- **D-02:** **ad-hoc one-off 실행도 지원**하지만 보조 경로다. primary UX는 named workflow 실행이다.

### User-facing commands
- **D-03:** Named workflow 실행 커맨드는 `wrapper workflow <name>` 형태로 제공한다.
- **D-04:** Ad-hoc one-off 실행은 별도 커맨드 `wrapper workflow-run ...` 형태로 제공한다.
- **D-05:** workflow 실행 기능은 alias namespace와 분리된 전용 command surface를 갖는다. alias와 workflow를 같은 namespace에 섞지 않는다.

### Workflow config binding
- **D-06:** Named workflow 정의는 concrete provider를 직접 적는 대신 **role 이름을 참조**한다.
- **D-07:** 실제 provider 해석은 기존 config의 `roles` 매핑이 담당한다. 즉 workflow config와 role→provider 매핑은 분리한다.
- **D-08:** 이 설계는 Phase 2의 “config에 role mapping 선언”과 “no wrapper DSL” 결정을 그대로 계승한다.

### Runtime overrides
- **D-09:** Named workflow를 실행할 때도 one-run override를 허용한다.
- **D-10:** Override 범위는 넓게 허용한다. planner/reviewer role, max iterations뿐 아니라 provider extra args와 model 관련 launch 옵션도 실행 시점에 덮어쓸 수 있다.
- **D-11:** Ad-hoc 실행(`wrapper workflow-run`)은 이 override surface를 직접 사용하는 경로다.

### Approval contract
- **D-12:** Reviewer approval 여부는 reviewer output file의 **structured status field**로 판정한다. 자연어 해석이나 provider-specific parsing에 의존하지 않는다.
- **D-13:** Review 결과는 최소한 `approved` vs `changes_requested` 같은 machine-readable 상태를 노출해야 한다.

### Loop termination
- **D-14:** Reviewer가 approval 상태를 기록하면 loop를 종료한다.
- **D-15:** 최대 iteration에 도달했는데 approval이 없으면 해당 run은 **non-approved 상태로 종료**한다.
- **D-16:** iteration limit 도달 시 마지막 artifacts는 모두 보존한다.
- **D-17:** non-approved 종료 직후 사용자는 다음 액션(재실행, 설정 변경, 수동 이어가기 등)을 선택할 수 있어야 한다. 단, 같은 run이 limit를 넘어 계속 이어지지는 않는다.

### Artifact persistence
- **D-18:** Workflow artifacts는 repo 내부의 wrapper 관리 디렉터리(예: `.wrapper/workflows/...`) 아래에 저장한다. portability 원칙상 global path는 사용하지 않는다.
- **D-19:** Artifact는 workflow run 단위 디렉터리로 나눈다. 각 run은 timestamp 또는 ID 기반 디렉터리를 가지며, 그 안에 iteration 기록을 보관한다.
- **D-20:** exact file layout(예: per-iteration file set, metadata file naming, latest pointer 등)은 이번 discuss 단계에서 잠그지 않는다. planner가 위의 high-level contract 안에서 구체화한다.

### the agent's Discretion
- Exact workflow config schema shape (`workflows` section structure, field names, validation strategy)
- Per-iteration artifact file naming (`iteration-01/plan.md` vs 다른 naming)
- Structured status field를 frontmatter에 둘지 별도 metadata file에 둘지에 대한 최종 구현 선택
- `wrapper workflow` / `wrapper workflow-run`의 help text, output wording, exit code detail

</decisions>

<specifics>
## Specific Ideas

- 사용자가 원한 방향은 “cao 편하게 쓰기 + workflow를 정의해두고 쓰기”이며, wrapper가 그 launcher/config portability layer 역할을 한다.
- wrapper는 새 orchestration DSL이 아니라 **cao를 감싸는 편의 레이어**여야 한다.
- 이전 탐색에서 확인한 바에 따르면 cao는 provider를 추상적으로만 선택하는 것이 아니라 내부 provider 구현에서 실제 CLI(`claude`, `codex`, `gemini`, `copilot` 등)를 tmux 세션에서 직접 실행한다. 따라서 workflow/run override surface는 wrapper와 cao 경계 모두를 고려해야 한다.
- User-facing workflow UX는 “정의형 우선, ad-hoc 보조”가 핵심이다.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and success criteria
- `.planning/ROADMAP.md` §Phase 3: Plan→Review Orchestration Loop — phase goal, success criteria, and dependency on Phase 2

### Project constraints and locked decisions
- `.planning/PROJECT.md` §Core Value — portability-first requirement
- `.planning/PROJECT.md` §Constraints — tmux conf non-intrusive rule, registry coupling prohibition, repo-contained reproducibility
- `.planning/PROJECT.md` §Key Decisions — especially “wrapper DSL 미도입”

### Current project state
- `.planning/STATE.md` — current focus, phase blockers, and Phase 3 concerns

### Prior phase foundation
- `.planning/phases/02-cli-aliases-workflow-config/02-CONTEXT.md` — role mapping and config decisions that Phase 3 must build on
- `.planning/phases/02-cli-aliases-workflow-config/02-VERIFICATION.md` — verified alias/config foundation available to Phase 3

No additional in-repo specs exist yet — requirements for this phase are fully captured in the roadmap and decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/config/wrapper-config.ts` — existing `.wrapper.json` loader and `roles` mapping support already exist; Phase 3 should extend this config surface rather than invent a parallel config mechanism
- `src/commands/alias.ts` — established spawn pattern for invoking `cao launch` with passthrough args
- `src/cli.ts` — existing command dispatch surface where `workflow` and `workflow-run` commands can be added

### Established Patterns
- Zero runtime dependencies remain the default project bias
- Config is repo-local and committed for portability (`.wrapper.json`)
- Built-ins use explicit command handlers under `src/commands/`
- Wrapper currently delegates orchestration semantics outward instead of inventing a wrapper-owned DSL

### Integration Points
- Extend `.wrapper.json` schema with workflow definitions while preserving existing `aliases` and `roles`
- Add `src/commands/workflow.ts` and/or `src/commands/workflow-run.ts` for the two execution paths
- Persist run artifacts under a repo-local wrapper-managed directory such as `.wrapper/workflows/`
- Bridge workflow-level overrides into the eventual CAO/provider launch path without breaking Phase 2 alias behavior

### Known Concerns
- Shell readiness polling with zsh + oh-my-zsh needs careful handling for send-keys driven orchestration
- CAO handoff/assign signal format is not fully documented, so the implementation should keep the loop contract flexible

</code_context>

<deferred>
## Deferred Ideas

- Exact per-iteration artifact file set and metadata file naming — leave to planner/implementation
- Direct CLI launch presets outside the Phase 3 workflow contract — possible future enhancement
- Broader workflow library/registry distribution — separate future scope

</deferred>

---

*Phase: 03-plan-review-orchestration-loop*
*Context gathered: 2026-03-24*
