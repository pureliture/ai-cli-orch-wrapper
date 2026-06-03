## 1. 진입점 단일화 (D)

- [x] 1.1 `templates/commands/antigravity/{review,adversarial,rescue}.md` 제거
- [x] 1.2 `.claude/commands/{review,execute,research}.md` 제거
- [x] 1.3 `antigravity:setup`을 위임에서 분리(프로비저닝 안내로 재배치)
- [x] 1.4 `packages/installer/src/commands/pack-install.ts` 배포 목록에서 제거된 커맨드 정리
- [x] 1.5 `aco-delegation` 정책(SKILL.md)과 진입점 목록을 `/aco`·`$aco` 단일 기준으로 정합
- [x] 1.6 README·CLI `--help`·기여 가이드 등 문서의 제거 진입점 참조를 `/aco`·`$aco` 기준으로 일괄 정리(문서 reframe 일부는 415ba4d에서 완료)
- [x] 1.7 `npm run check:skill-templates` 통과 확인

## 2. /aco·$aco 본문 재작성 (D)

- [x] 2.1 `.claude/commands/aco.md` 본문을 "자연어 결정 → 계획 제시 → 동의 → `aco ask --yes` 실행 → brief 반환"으로 재작성
- [x] 2.2 프롬프트에 provider 명시 시 그 provider로 고정하는 분기 추가
- [x] 2.3 미인증 provider 시 setup 안내(가능하면 동의 기반 interactive provisioning 후 원 작업 복귀) 분기 추가
- [x] 2.4 `templates/commands/aco.md` 동기화
- [x] 2.5 `.codex/skills/aco/SKILL.md`(`$aco`) 패리티 반영
- [x] 2.6 금지 subcommand(`status`·`result`·`cancel`·`delegate`) 가드레일 구현 + syntactic integration test로 자동 검증
- [x] 2.7 `--permission-profile`을 하위 provider에 명시 전파 + 미지원 provider 실행 차단
- [x] 2.8 최소 컨텍스트 전달(강제 marshaling 없음) 보장 + 검증
- [x] 2.9 자연어 의도 해석 실패·사용자 취소(Ctrl+C)·중복 동시 호출 정책 구현

## 3. 공통 runtime 커널 추출 + ask 대시보드 (C)

- [x] 3.1 `renderRuntimeDashboard`·`collectRuntimeContext`를 `cmdRun`에서 공통 `runtime/` 모듈로 추출
- [x] 3.2 `packages/wrapper/src/commands/ask.ts`에서 커널을 호출해 대시보드 렌더 연결
- [x] 3.3 `aco run`(`packages/wrapper/src/cli.ts` `cmdRun`)이 동일 커널을 사용하도록 전환
- [x] 3.4 공통 커널에 `getPrimarySession()` 하위호환 헬퍼 제공(단일세션 접근부 회귀 방지)
- [x] 3.5 `aco run` 대시보드 회귀 테스트 추가/통과
- [x] 3.6 `aco ask` 경로 대시보드 수집·렌더 단위/통합 테스트 추가/통과

## 4. 멀티프로바이더 롤업 + provider 아이콘 (C)

- [x] 4.1 `collectRuntimeContext`를 단일 세션 → 멀티 세션 모델로 확장
- [x] 4.2 대시보드를 롤업 헤더(command·branch) + provider별 행(session·auth)으로 렌더
- [x] 4.3 `IProvider`에 `readonly icon` 필드 추가(`interface.ts`)
- [x] 4.4 각 provider에 icon 지정(antigravity 🔵 · codex 🟢 · mock ⚪) + registry 조회
- [x] 4.5 대시보드 provider 행 앞에 `icon` 렌더(host 헤더 🟠)
- [x] 4.6 `--no-unicode`/비-UTF-8 감지 시 ASCII 아이콘 폴백(`[AG]`/`[CX]`/`[MC]`) + 유니코드 호환성 테스트
- [x] 4.7 멀티프로바이더 부분 인증 실패(abort vs degraded) 처리 + 대시보드 상태 표시

## 5. 출력 동기화 · TTY · 검증

- [x] 5.1 비-TTY=대시보드 비활성/요약 로거, `NO_COLOR`=색 제거로 분리 구현
- [x] 5.2 stdout `brief`를 대시보드 렌더 완료 후 일괄 출력 + 100~200ms throttle/deadband 적용
- [x] 5.3 파이프(비-TTY) 출력 테스트 추가/통과
- [x] 5.4 멀티프로바이더 롤업 렌더 테스트 추가/통과
- [x] 5.5 기본 `brief` 출력 정합성 테스트 추가/통과
- [x] 5.6 `pack install` 후 위임 진입점이 `/aco`(+`$aco`)만 노출됨을 fixtures/smoke로 확인
- [x] 5.7 rollback 절차(릴리즈 이전 상태 복원) 검증
- [x] 5.8 `npm run verify`(lint·contract·typecheck·test·go·fixtures·smoke) 통과
- [x] 5.9 (후속 마일스톤) `openspec/specs/aco-v2-spec.md` 동기화 부채 기록·추적 — design.md에 drift 부채 명시됨
