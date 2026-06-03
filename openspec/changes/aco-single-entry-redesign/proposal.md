## Why

현재 외부 AI 위임 표면이 파편화되어 있다. 사용자向 위임 진입점이 `/aco`(+`$aco`) 하나여야 하는데 실제로는 7개(`/antigravity:review|adversarial|rescue`, `/review`, `/execute`, `/research`)가 공존하고, 그중 `/antigravity:*`는 `aco run`을 직접 불러 consent gate를 우회한다. 또한 멀티프로바이더 advisory 실행과 동의를 담당하는 `aco ask`(정본 `/aco` 경로)는 런타임 대시보드를 렌더하지 않고, 대시보드는 제거 대상인 `aco run` 경로에서만 보인다. 사용자가 단일 스킬로 위임하고 실행 상태를 한눈에 보게 하려면 표면을 `/aco`·`$aco`로 수렴하고 대시보드를 정본 경로로 옮겨야 한다.

## What Changes

- **BREAKING** 배포 위임 진입점을 `/aco`·`$aco` 하나로 수렴한다. `/antigravity:review|adversarial|rescue`와 `/review`·`/execute`·`/research`를 제거한다(별칭·유예 없음).
- `antigravity:setup`(프로비저닝)을 위임 커맨드에서 분리하고, 미인증 시 `/aco`가 setup을 안내하도록 한다.
- `/aco`·`$aco` 본문을 "컨텍스트 읽고 작업·provider 자연어 결정 → 실행 계획 제시 → 동의 시 실행 → 요약 반환"으로 재작성한다. 기본 출력은 `brief`. 프롬프트에 provider가 명시되면 그걸 고정한다. `/aco`에 task-specific subcommand나 flag를 붙이지 않는다.
- `renderRuntimeDashboard`·`collectRuntimeContext`를 공통 `runtime/` 커널로 추출해 `aco ask`도 'aco Runtime Session' 대시보드를 렌더하게 한다. 커맨드(`aco ask`/`aco run`)는 분리 유지, 내부 커널만 통합한다.
- 멀티프로바이더 대시보드는 롤업 헤더(command·branch) + provider별 행(session·auth)으로 렌더한다. `collectRuntimeContext`를 멀티 세션 모델로 확장한다.
- `IProvider`에 `readonly icon` 필드를 추가하고, 대시보드가 provider별 색동그라미 이모지(antigravity 🔵 · codex 🟢 · mock ⚪, host 헤더 🟠)를 렌더한다.
- stdout `brief`와 stderr 대시보드 충돌을 막는다: 비-TTY는 대시보드 비활성/요약 로거, `NO_COLOR`는 색만 제거, brief는 대시보드 렌더 완료 후 일괄 출력하며 갱신은 throttle(100~200ms)한다.
- `/aco`·`$aco` 본문에 금지 subcommand(`status`·`result`·`cancel`·`delegate`) 가드레일을 두어, 그 입력이 자연어 위임으로 오인되지 않고 하부 CLI 안내로 유도되게 한다.
- `/aco`가 받은 `--permission-profile`을 하위 provider 기동 시 명시적으로 전파하고, 프로필을 지원하지 않는 provider는 실행을 차단한다(보안 최소 규격).
- provider 아이콘은 비-UTF-8/구형 터미널 대비 `--no-unicode`(또는 감지) ASCII 폴백(`[AG]`/`[CX]`/`[MC]`)을 제공한다.
- 미인증 시 `/aco`가 setup을 안내하고, 가능하면 동의 기반 interactive provisioning 후 원 작업으로 복귀한다.
- 멀티프로바이더 부분 인증 실패, 자연어 의도 해석 실패, 사용자 취소(Ctrl+C), 중복 동시 호출에 대한 정책을 정의한다.

## Capabilities

### New Capabilities
- `aco-skill-entry`: `/aco`·`$aco`를 유일한 위임 진입점으로 정의한다 — 자연어 task 기반 consent-gated 위임(계획 제시 → 동의 → 실행 → 요약), 경쟁/우회 진입점 제거, provisioning 분리.
- `aco-runtime-dashboard`: `aco ask`·`aco run`이 공통 runtime 커널로 'aco Runtime Session' 대시보드를 렌더한다 — 멀티프로바이더 롤업, provider별 아이콘, TTY-aware 억제.

### Modified Capabilities
<!-- spec-level 요구사항 변경은 위 신규 capability가 흡수한다. 기존 openspec/specs/aco-v2-spec.md는 본 change에서 재작성하지 않는다. -->

## Impact

- 영향 코드: `.claude/commands/aco.md`·`templates/commands/aco.md`(본문 재작성), `templates/commands/antigravity/*`·`.claude/commands/{review,execute,research}.md`(제거), `.codex/skills/aco/`(`$aco` 패리티), `packages/wrapper/src/commands/ask.ts`, `packages/wrapper/src/cli.ts`(`cmdRun`), `packages/wrapper/src/runtime/{dashboard,context,types}.ts`(커널 추출·멀티세션), `packages/wrapper/src/providers/{interface,registry,antigravity,codex,mock}.ts`(`icon` 필드).
- 배포/호환: `/antigravity:*` 제거는 pack 사용자에게 보이는 breaking change. README·ACO.md 등 문서는 별도 커밋(415ba4d)에서 이미 스킬-시나리오로 reframe됨.
- 검증: `pack install` 후 위임 진입점이 `/aco`(+`$aco`)만 노출, `/aco`→`aco ask` 실행 시 대시보드 표시, 멀티프로바이더 롤업, 비-TTY 폴백, `aco run` 회귀 없음, `npm run verify`·`check:skill-templates` 통과.
- 관련 위험(별도 처리): 리서치 중 `aco ask --permission-profile restricted`가 antigravity(agy) 같은 외부 agentic CLI의 파일·git 변경을 막지 못함을 확인했다. 본 change 범위 밖이며 별도 hardening으로 다룬다.
- 메인 스펙 drift: `openspec/specs/aco-v2-spec.md`는 본 change에서 재작성하지 않으므로 후속 마일스톤에서 동기화하는 부채로 명시한다.
- 추적: GitHub #161.
