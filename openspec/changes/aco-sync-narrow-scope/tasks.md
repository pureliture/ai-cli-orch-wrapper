## 1. Sync 엔진 범위 축소

- [x] 1.1 `packages/wrapper/src/sync/sync-engine.ts`의 target set에서 project-guidance(`AGENTS.md`/`GEMINI.md`)를 제거
- [x] 1.2 `context-transform.ts`·`managed-block.ts`의 `AGENTS.md`/`GEMINI.md` 생성 경로를 삭제(구조적 표면 변환 경로는 보존). sync가 이 파일들을 읽거나 감지하지 않음
- [x] 1.3 `--check`/`--strict`/`--force`/`--dry-run`이 구조적 표면 target만 다루도록 정리(`AGENTS.md`는 target이 아니므로 자연 제외)

## 2. Manifest

- [x] 2.1 manifest가 줄어든 target set으로 재생성되어 옛 `AGENTS.md`/`GEMINI.md` 키가 자연히 빠짐을 보장(전용 prune 코드 없음; 구버전 manifest의 잔존 키는 무시·에러 없음)

## 3. AGENTS.md 손유지 전환 + provider-native 소유권 (#145 흡수)

- [x] 3.1 이 repo `AGENTS.md`의 죽은 `ACO GENERATED CONTEXT` 관리 블록 마커를 1회 손으로 제거(평범한 편집, sync 무관)
- [x] 3.2 Codex `$aco`/`aco delegate` 진입점을 `AGENTS.md` 손유지 섹션으로 편입
- [x] 3.3 `.codex/skills/aco/SKILL.md` 일급 스킬 추가 — Claude `/aco`(`.claude/commands/aco.md`) + `aco-delegation` 미러, `aco ask` consent-gate + `aco delegate` 두 흐름. `.codex/skills/` 손유지 정책 예외임을 명시

## 4. CLAUDE.md + 문서 갱신

- [x] 4.1 root `CLAUDE.md`의 `## Codex $aco Entrypoint` 절을 Claude 시점만 남기도록 정리(Codex-native 내용은 `AGENTS.md`로 이전)
- [x] 4.2 `docs/reference/context-sync.md`를 새 책임 경계(구조적 표면만 sync, guidance md는 손유지)로 갱신
- [x] 4.3 README/AGENTS의 sync surface 설명에서 `AGENTS.md` "generated" 표현 정정

## 5. 테스트 / CI

- [x] 5.1 context-sync fixtures에서 `AGENTS.md`/`GEMINI.md` 생성 기대 제거, 구조적 표면 생성 기대 유지
- [x] 5.2 `aco sync`가 `AGENTS.md`를 읽지·쓰지 않으며 옛 마커가 byte 단위로 불변임을 검증하는 테스트
- [x] 5.3 `aco sync --check --strict`가 `AGENTS.md`를 대상에서 제외함을 검증(편집해도 drift 아님)
- [ ] 5.4 (#145 흡수) `.codex/skills/aco`의 `aco ask` consent-gate(dry-run→`--yes`) + `aco delegate` 흐름 통합 테스트 — 스킬은 thin 문서 래퍼라 새 런타임 코드 없음. 하위 흐름은 기존 `tests/ask-cli.test.ts`·`tests/delegate.test.ts`로 커버됨(추가 통합 테스트는 선택)
- [x] 5.5 `npm test`·`npm run typecheck`·`npm run test:fixtures`·`aco sync --check --strict` green 확인

## 6. 검증 / 마무리

- [x] 6.1 `openspec validate aco-sync-narrow-scope` 통과
- [x] 6.2 이슈 #145 흡수 반영(이미 close됨, 구현 PR에서 참조)
