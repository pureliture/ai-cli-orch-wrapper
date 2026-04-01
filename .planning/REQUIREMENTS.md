# Requirements: ai-cli-orch-wrapper

**Defined:** 2026-04-02
**Core Value:** Claude Code를 오케스트레이터로, 다른 AI CLI를 서브에이전트로 — 슬래시 커맨드 하나로 즉시 사용

## v1.2 Requirements

Blueprint Step 3-6 기반. 결과물은 `.claude/commands/aco/` 슬래시 커맨드.

### Adapter Infrastructure

- [ ] **ADPT-01**: Gemini-CLI를 서브에이전트로 실행할 수 있다 (subprocess spawn + stdin prompt 전달 + stdout 수집)
- [ ] **ADPT-02**: Copilot-CLI를 서브에이전트로 실행할 수 있다 (동일 패턴, CLI별 quirk 대응)
- [ ] **ADPT-03**: adapter가 설치되지 않은 경우 명확한 오류 메시지를 출력한다
- [ ] **ADPT-04**: `.wrapper.json` v2.0 라우팅 설정으로 커맨드별 adapter를 지정할 수 있다 (`routing.review`, `routing.adversarial`)

### /aco:review

- [ ] **REV-01**: `git diff HEAD`를 routing config의 review adapter에 dispatch한다
- [ ] **REV-02**: 파일 경로를 인자로 받으면 해당 파일 내용을 review 대상으로 사용한다
- [ ] **REV-03**: `git diff HEAD` 결과가 없으면 `git diff HEAD~1`을 시도하고, 그래도 없으면 "No changes detected" 오류를 출력한다
- [ ] **REV-04**: `--target <adapter>` flag로 routing config를 override할 수 있다

### /aco:status

- [ ] **STAT-01**: 설정된 모든 adapter의 가용성을 병렬로 확인해 `✓ / ✗` 형식으로 출력한다
- [ ] **STAT-02**: 현재 routing 설정(커맨드 → adapter 매핑)을 표 형식으로 출력한다
- [ ] **STAT-03**: `.wrapper.json`이 없으면 "Run /aco:init first" 안내를 출력한다

### /aco:adversarial

- [ ] **ADV-01**: review보다 공격적인 프롬프트로 routing config의 adversarial adapter에 dispatch한다
- [ ] **ADV-02**: `--focus <security|performance|correctness|all>` 옵션으로 리뷰 초점을 좁힌다 (기본: all)
- [ ] **ADV-03**: input 우선순위는 `/aco:review`와 동일하다 (파일 > git diff > 오류)
- [ ] **ADV-04**: `--target <adapter>` flag로 routing config를 override할 수 있다

## v1.3 Requirements (Deferred)

### /aco:rescue

- **RESC-01**: `--from <file>`, `--error <message>`, stdin 세 가지 input 경로를 지원한다
- **RESC-02**: `git log -5 --oneline`을 자동으로 컨텍스트에 삽입한다
- **RESC-03**: `--from`과 `--error`를 동시에 제공하면 둘을 병합해 사용한다

### /aco:init

- **INIT-01**: 가용한 adapter를 자동 감지해 라우팅 설정을 대화형으로 구성한다
- **INIT-02**: 감지된 adapter만 선택지로 표시한다 (미설치 adapter 숨김)
- **INIT-03**: `.wrapper.json`이 이미 있으면 마이그레이션 확인 후 업데이트한다

### Integration Tests + Docs

- **INT-01**: 전체 커맨드 흐름 통합 테스트
- **INT-02**: README v2.0 업데이트 (커맨드 레퍼런스 표 포함)

## Out of Scope

| Feature | Reason |
|---------|--------|
| `aco` CLI 바이너리 유지 | v1.2부터 슬래시 커맨드 전용으로 전환 |
| TypeScript 소스 코드 | `src/` 삭제됨 — 슬래시 커맨드는 Markdown + Bash |
| cao 오케스트레이션 | 제거됨 (Blueprint Step 1) |
| tmux 세션 관리 | CC 슬래시 커맨드 패턴에서 불필요 |
| registry-hub 연동 | 외부 병렬 개발 중, 이번 범위 밖 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADPT-01 | Phase 6 | Pending |
| ADPT-02 | Phase 6 | Pending |
| ADPT-03 | Phase 6 | Pending |
| ADPT-04 | Phase 6 | Pending |
| REV-01 | Phase 7 | Pending |
| REV-02 | Phase 7 | Pending |
| REV-03 | Phase 7 | Pending |
| REV-04 | Phase 7 | Pending |
| STAT-01 | Phase 7 | Pending |
| STAT-02 | Phase 7 | Pending |
| STAT-03 | Phase 7 | Pending |
| ADV-01 | Phase 8 | Pending |
| ADV-02 | Phase 8 | Pending |
| ADV-03 | Phase 8 | Pending |
| ADV-04 | Phase 8 | Pending |

**Coverage:**
- v1.2 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 — traceability confirmed after roadmap creation*
