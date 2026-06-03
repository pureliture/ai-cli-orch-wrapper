## 1. 진입점 단일화 (D)

- [ ] 1.1 `templates/commands/antigravity/{review,adversarial,rescue}.md` 제거
- [ ] 1.2 `.claude/commands/{review,execute,research}.md` 제거
- [ ] 1.3 `antigravity:setup`을 위임에서 분리(프로비저닝 안내로 재배치)
- [ ] 1.4 `packages/installer/src/commands/pack-install.ts` 배포 목록에서 제거된 커맨드 정리
- [ ] 1.5 `aco-delegation` 정책(SKILL.md)과 진입점 목록을 `/aco`·`$aco` 단일 기준으로 정합
- [ ] 1.6 `npm run check:skill-templates` 통과 확인

## 2. /aco·$aco 본문 재작성 (D)

- [ ] 2.1 `.claude/commands/aco.md` 본문을 "자연어 결정 → 계획 제시 → 동의 → `aco ask --yes` 실행 → brief 반환"으로 재작성
- [ ] 2.2 프롬프트에 provider 명시 시 그 provider로 고정하는 분기 추가
- [ ] 2.3 미인증 provider 시 setup 안내 분기 추가
- [ ] 2.4 `templates/commands/aco.md` 동기화
- [ ] 2.5 `.codex/skills/aco/SKILL.md`(`$aco`) 패리티 반영
- [ ] 2.6 `/aco status` 등 task-specific subcommand가 생기지 않음을 확인

## 3. 공통 runtime 커널 추출 + ask 대시보드 (C)

- [ ] 3.1 `renderRuntimeDashboard`·`collectRuntimeContext`를 `cmdRun`에서 공통 `runtime/` 모듈로 추출
- [ ] 3.2 `packages/wrapper/src/commands/ask.ts`에서 커널을 호출해 대시보드 렌더 연결
- [ ] 3.3 `aco run`(`cmdRun`)이 동일 커널을 사용하도록 전환
- [ ] 3.4 `aco run` 대시보드 회귀 테스트 추가/통과

## 4. 멀티프로바이더 롤업 + provider 아이콘 (C)

- [ ] 4.1 `collectRuntimeContext`를 단일 세션 → 멀티 세션 모델로 확장
- [ ] 4.2 대시보드를 롤업 헤더(command·branch) + provider별 행(session·auth)으로 렌더
- [ ] 4.3 `IProvider`에 `readonly icon` 필드 추가(`interface.ts`)
- [ ] 4.4 각 provider에 icon 지정(antigravity 🔵 · codex 🟢 · mock ⚪) + registry 조회
- [ ] 4.5 대시보드 provider 행 앞에 `icon` 렌더(host 헤더 🟠)

## 5. TTY 억제 + 검증

- [ ] 5.1 비-TTY/`NO_COLOR`에서 stderr 대시보드 억제·폴백 추가(stdout `brief` 보호)
- [ ] 5.2 파이프(비-TTY) 출력 테스트 추가/통과
- [ ] 5.3 멀티프로바이더 롤업 렌더 테스트 추가/통과
- [ ] 5.4 `pack install` 후 위임 진입점이 `/aco`(+`$aco`)만 노출됨을 fixtures/smoke로 확인
- [ ] 5.5 `npm run verify`(lint·contract·typecheck·test·go·fixtures·smoke) 통과
