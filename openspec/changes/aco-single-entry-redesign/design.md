## Context

`/aco`는 단일 generic delegation command으로 의도되었지만, 실제 표면은 `/aco`·`$aco` 외에 `/antigravity:review|adversarial|rescue`, `/review`·`/execute`·`/research`까지 7개로 파편화되어 있다. `/antigravity:*`는 `aco run`을 직접 호출해 consent gate를 우회한다. 또한 'aco Runtime Session' 대시보드는 `cmdRun`(=`aco run`)에서만 렌더되어, 정본 `/aco`→`aco ask` 경로에서는 보이지 않는다.

2026-06-03 멀티에이전트 분석(Claude readers + aco→antigravity fan-out)으로 위 gap을 확정했고, 설계 결정 7+1건을 잠갔다. 사용자向 문서 reframe는 별도 커밋(415ba4d)에서 완료되어, 이 change는 런타임·진입점 구현을 다룬다.

## Goals / Non-Goals

**Goals:**
- 배포 위임 진입점을 `/aco`·`$aco` 하나로 수렴(경쟁·우회 진입점 제거).
- `/aco`·`$aco` 본문을 자연어 결정 → 계획 제시 → 동의 → 실행 흐름으로 재작성.
- `aco ask` 경로에서 런타임 대시보드 렌더(공통 커널), 멀티프로바이더 롤업, provider 아이콘.
- stdout `brief`와 stderr 대시보드 충돌 방지(TTY 인식 억제).

**Non-Goals:**
- `aco ask`와 `aco run` 커맨드 병합(분리 유지, 내부 커널만 통합).
- 외부 agentic CLI 샌드박싱 hardening 본체(`restricted` 프로필이 외부 CLI 파일·git 변경을 강제 차단) — 별도 change. 단, profile 전파·미지원 provider 차단의 최소 규격은 D9로 본 change에 포함한다.
- 백그라운드/async 실행.
- `openspec/specs/aco-v2-spec.md` 전면 재작성.

## Decisions

- **D1 판단=Claude, 실행=aco.** 작업·provider 결정은 슬래시 커맨드 본문을 실행하는 Claude/Codex 모델이 한다. *대안:* aco CLI 내부 LLM 라우팅 — Claude 대화·편집 컨텍스트를 직렬화해 CLI로 넘겨야 해 오버헤드·복잡도 증가, 기각.
- **D2 옵션 C 채택(공통 runtime 커널 추출).** `renderRuntimeDashboard`·`collectRuntimeContext`를 `runtime/` 공통 모듈로 올려 `aco ask`·`aco run`이 공유. *대안 B(`/aco`→`aco run` 라우팅):* consent gate·멀티프로바이더·자연어 task를 상실해 기각. *대안 A(ask에 직접 이식):* 동작은 하나 커널 분리가 없어 C 대비 관심사 분리 열위.
- **D3 커맨드 분리 유지.** `aco ask`=선언적 멀티프로바이더 advisory, `aco run`=명령형 단일 provider 디버그. 통합은 사용자 커맨드 레이어가 아니라 내부 커널/렌더 레이어에서만(antigravity 권고와 일치).
- **D4 진입점 즉시 제거(별칭·유예 없음).** `/antigravity:*`·`/review`·`/execute`·`/research` 삭제. breaking change 허용. *대안:* 제거 커맨드에 "지원 중단 — `/aco`·`$aco` 사용" 안내 + exit 1을 내는 deprecation stub를 한 버전 유지(리뷰 다수 권장). surface 축소의 단순성·즉시성을 우선해 기각하고 즉시 제거를 유지한다.
- **D5 멀티프로바이더 대시보드 = 롤업 헤더(command·branch) + provider별 행(session·auth).** `collectRuntimeContext`를 단일 세션에서 멀티 세션 모델로 확장. 단일→멀티 전환이 기존 `aco run`의 `context.session.id` 단일 접근부를 회귀(TypeError)시키지 않도록, 공통 커널은 `getPrimarySession()` 하위호환 헬퍼를 제공한다.
- **D6 provider 아이콘 = `IProvider.icon` 색동그라미 이모지.** antigravity 🔵 · codex 🟢 · mock ⚪ · host 헤더 🟠. *근거:* 이모지는 portable·고정색·ANSI 불필요(터미널/Claude Code/파이프/CI 안전). *대안 ANSI truecolor 마커/그라데이션:* 이모지 색 recolor 불가·truecolor 미보장으로 기각. 이모지 이식성(East Asian Width·비-UTF-8 locale·구형 tty mojibake) 대비로 `--no-unicode`(또는 비-UTF-8 감지) 시 ASCII 폴백(`[AG]`/`[CX]`/`[MC]`)을 제공한다.
- **D7 컨텍스트 = 느슨.** 모델이 구성한 `--task` 문자열 전달로 충분. 강제 context-marshaling(diff·branch 매번 긁기) 안 함.
- **D8 TTY/NO_COLOR 분리 처리 + 출력 동기화.** 비-TTY(파이프/CI)에서는 stderr 대시보드를 완전 비활성화(또는 주기적 1줄 요약 로거)하고, `NO_COLOR`에서는 색만 제거하고 평문 대시보드는 유지한다. stdout `brief`는 대시보드 렌더 완료 후 일괄 출력해 충돌을 막고, 대시보드 갱신은 100~200ms throttle/deadband로 flicker·CPU를 제어한다.
- **D9 permission-profile 전파(보안 최소 규격).** `/aco`가 받은 `--permission-profile`을 하위 provider 기동 시 환경/인자로 명시 전파하고, 프로필을 지원하지 않는 provider는 실행을 차단한다. 외부 agentic CLI 샌드박싱 hardening 본체는 별도 change지만, 단일 진입점 신뢰(사용자가 restricted가 모든 하위에 적용된다고 믿음)를 깨지 않기 위해 전파·차단 규격은 본 change에 포함한다.
- **D10 금지 subcommand 가드레일.** `/aco`·`$aco` 본문은 첫 토큰이 `status`·`result`·`cancel`·`delegate`이면 자연어 위임으로 처리하지 않고 해당 하부 CLI 사용을 안내한다. 이는 syntactic test로 검증한다.

## Risks / Trade-offs

- [`restricted` 프로필이 외부 agentic CLI(agy)의 파일·git 변경을 막지 못함 — 리서치 중 antigravity가 실제 worktree·커밋 생성] → 본 change 밖, 별도 hardening change로 추적.
- [`collectRuntimeContext` 멀티세션 변경이 `aco run` 단일세션 동작을 회귀시킬 수 있음] → `aco run` 대시보드 회귀 테스트 추가.
- [`/antigravity:*` 제거가 pack 사용자에게 breaking] → CHANGELOG·README 명시(문서 reframe는 415ba4d). 별칭 제공 안 함(D4).
- [TTY 억제 누락 시 비-TTY 환경에서 brief/대시보드 출력 깨짐] → 파이프·비-TTY 테스트 명시.
- [stdout `brief`와 stderr 대시보드 동시 출력 시 화면 충돌·flicker·CPU 급증] → 렌더 선후 동기화 + 100~200ms throttle(D8).
- [`/aco status` 등 금지 subcommand가 자연어로 오인돼 외부 위임 트리거] → 파서 가드레일 + syntactic test(D10).
- [색동그라미 이모지가 비-UTF-8·구형 터미널에서 깨짐/너비 밀림] → ASCII 폴백(D6).
- [멀티프로바이더 부분 인증 실패 시 동작 미정] → abort vs degraded 정책 spec에 명시.

## Migration Plan

1. D 단계(surface 축소): 문서 reframe(415ba4d, 일부 완료) + `/antigravity:*`·`/review`·`/execute`·`/research` 제거 + `/aco`·`$aco` 본문 재작성 + `antigravity:setup` 분리.
2. C 단계(커널): `renderRuntimeDashboard`·`collectRuntimeContext` 공통 `runtime/` 추출 → `aco ask` 연결 + 멀티세션 + TTY 억제 + `IProvider.icon`.
3. 검증: `pack install` 진입점 확인, `/aco`→대시보드, 멀티프로바이더 롤업, 비-TTY 폴백, `aco run` 회귀, `npm run verify`·`check:skill-templates`.

Rollback: 커밋 단위 revert. 커맨드 제거(D4)는 templates 파일 복원으로 되돌릴 수 있다.

`openspec/specs/aco-v2-spec.md`는 본 change에서 재작성하지 않으므로, 메인 스펙과의 drift를 후속 마일스톤에서 동기화하는 부채로 남긴다.

## Open Questions

- provider 자동선택 시 확인 단계에서 사용자가 provider를 조정하는 UX 세부(제안→수정).
- 멀티세션 `collectRuntimeContext`의 정확한 렌더 형태(세션별 row vs 부분 롤업) 최종 확정.
- provider 아이콘 이모지 최종 확정(🔵/🟢/⚪/🟠 잠정, 교체 가능).
