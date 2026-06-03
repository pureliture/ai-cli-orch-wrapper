# @pureliture/ai-cli-orch-wrapper

## 0.5.0

### Minor Changes

- `aco sync`가 structured source(skill / Codex agent)가 하나도 없는 fresh repo에서 빈 manifest만 쓰고 성공하던 동작을 막고, 명확한 "No sync sources found" 에러로 non-zero 종료하도록 강화. 단 기존 manifest나 legacy 타깃이 있으면 통과시켜 stale-target·legacy Gemini·orphan Codex agent cleanup이 끝까지 돌게 한다 (#152).

### Patch Changes

- 11dc797: npm 배포 파이프라인 복원: `publishConfig.access = "public"` 추가, release workflow를 `release` label PR merge 전용으로 제한, `release` GitHub label 생성
- `aco ask --output-mode save-only|full`(stream-only) 경로에서 run/session ledger의 `outputBytes`가 16KB capture 상한에 잘린 버퍼로 계산돼 실제 출력보다 작게 기록되던 문제 수정. provider session runner가 capture 상한과 무관하게 실제 스트리밍된 UTF-8 총 바이트를 별도로 세어 반환한다 (#139).

## 0.4.1

### Patch Changes

- 4051fa2: npm 배포 파이프라인 복원: `publishConfig.access = "public"` 추가, release workflow를 `release` label PR merge 전용으로 제한, Changesets release PR에 `release` label 자동 적용
