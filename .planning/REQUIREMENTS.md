# Requirements: ai-cli-orch-wrapper

**Defined:** 2026-04-02
**Core Value:** Claude Code를 오케스트레이터로, 다른 AI CLI를 서브에이전트로 — 슬래시 커맨드 하나로 즉시 사용

## v1.3 Requirements

v1.3은 두 가지 축: (1) v1.2 carry-forward items (STAT-03, STAT-02, REV-04, ADV-04), (2) `/aco:init` 대화형 설정 + 통합 테스트/문서.

### Carry-Forward from v1.2

- [ ] **STAT-03**: `/gemini:status` / `/copilot:status` — `.wrapper.json`이 없으면 "Run /aco:init first" 안내를 출력한다
- [ ] **STAT-02**: 현재 routing 설정(커맨드 → adapter 매핑)을 표 형식으로 출력한다 (전용 `/aco:status` 중앙 커맨드로 구현)
- [ ] **REV-04**: `--target <adapter>` flag로 routing config를 override할 수 있다 (중앙 `/aco:review` 커맨드에서 구현)
- [ ] **ADV-04**: `--target <adapter>` flag로 routing config를 override할 수 있다 (중앙 `/aco:adversarial` 커맨드에서 구현)

### /aco:init

- [ ] **INIT-01**: 가용한 adapter를 자동 감지해 라우팅 설정을 대화형으로 구성한다
- [ ] **INIT-02**: 감지된 adapter만 선택지로 표시한다 (미설치 adapter 숨김)
- [ ] **INIT-03**: `.wrapper.json`이 이미 있으면 마이그레이션 확인 후 업데이트한다

### Integration Tests + Docs

- [ ] **INT-01**: 전체 커맨드 흐름 통합 테스트
- [ ] **INT-02**: README v2.0 업데이트 (커맨드 레퍼런스 표 포함)

## v1.4 Requirements (Deferred)

*(None defined yet — added as v1.3 work reveals new scope)*

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAT-03 | TBD | Pending |
| STAT-02 | TBD | Pending |
| REV-04 | TBD | Pending |
| ADV-04 | TBD | Pending |
| INIT-01 | TBD | Pending |
| INIT-02 | TBD | Pending |
| INIT-03 | TBD | Pending |
| INT-01 | TBD | Pending |
| INT-02 | TBD | Pending |

**Coverage:**
- v1.3 requirements: 9 total
- Mapped to phases: 0 (roadmap not yet defined)
- Unmapped: 9 (pending /gsd-new-milestone)

---
*Requirements defined: 2026-04-02*
*Previous milestone requirements: [v1.2-REQUIREMENTS.md](./milestones/v1.2-REQUIREMENTS.md)*
