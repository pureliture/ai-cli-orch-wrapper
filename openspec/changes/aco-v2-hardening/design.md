## Context

v2 아키텍처는 `aco delegate` CLI, frontmatter-driven provider routing, async state 제거 등을 완료했지만, production 사용을 위한 hardening 이 부족합니다. PR #12 review 와 multi-AI 회고에서 다음과 같은 gap 이 발견되었습니다:

1. `cmd_delegate.go` 의 `ACO_TIMEOUT_SECONDS` env 미지원
2. `gemini_cli.go` 의 미지원 옵션 (`--reasoning-effort`) 전달
3. `ACO_META` sentinel prefix collision 가능성
4. Go/Node.js 간 drift 방지 계약 부재
5. Adversarial 테스트 커버리지 부족

## Goals / Non-Goals

**Goals:**
- P0 hardening 항목 모두 해결 (command-line, provider, sentinel)
- Go/Node.js 계약 경계 문서화
- Adversarial 테스트로 실패 경로 검증
- CLAUDE.md v2 contract 으로 갱신

**Non-Goals:**
- 새로운 기능 추가 (Zero New Features 원칙)
- v2 아키텍처 변경 (하위 호환 유지)
- P2+ 항목 (예: `isolationMode: worktree`)

## Decisions

### 1. ACO_META Sentinel Collision 방지

**Decision**: Sentinel prefix 에 8바이트 랜덤 식별자 suffix 추가 (`ACO_META_<rid>:`, `<rid>` 는 16 hex chars)

**Alternatives considered:**
- Option B (stderr 분리): Provider stdout/stderr 혼합 시 파싱 복잡도 증가
- Option C (multi-line 구분자): 기존 parser 수정 필요

**Rationale**: 64비트 랜덤 식별자는 충돌 확률을 사실상 0 으로 만들며, parser 수정 최소화. RFC 4122 UUID 가 아닌 `crypto/rand` 기반 난수이므로 "UUID" 가 아닌 "랜덤 식별자" 로 명명.

**주의**: `crypto/rand` 읽기 실패 시 sentinel 없이 종료. 기존 caller 를 위한 마이그레이션 경로 명시 필요.

### 2. Gemini CLI 옵션 필터링

**Decision**: `gemini_cli.go` 에서 `effortMap.gemini_cli` 매핑을 **완전 제거** (YAGNI)

**Rationale**: Gemini CLI 가 해당 옵션을 지원하지 않으므로 silent fail 또는 에러 발생. Dormant code path 유지하지 않고, 향후 지원 시 새로 추가하는 방식.

### 3. Go/Node.js Contract 문서화

**Decision**: `docs/contract/go-node-boundary.md` 에 다음 명세:
- Go validation 책임: frontmatter parsing, formatter routing, CLI flag validation, 파일 경로 검증 (`..` 방지)
- Node.js wrapper 책임: provider runtime, session store, slash command dispatch
- Contract 검증: 양쪽 모두 `IProvider` interface 준수
- 환경 변수 화이트리스트: `ACO_TIMEOUT_SECONDS` 만 허용

**자동화**: CI 에서 공유 TypeScript 정의 파일 기준으로 Go/Node.js 인터페이스 일관성 자동 검증

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Sentinel 식별자가 output 에 노출 | Parser 가 식별자를 strip 하여 caller 에 전달 |
| Gemini CLI 옵션 제거로 기존 사용자 영향 | changelog 에 명시, major version bump |
| Adversarial 테스트 유지비 증가 | CI 에서 자동 실행, 실패 시 blocker |
| 파일 경로 traversal 공격 | `path/filepath.Clean()` + `..` 차단 |
| 환경 변수 삽입 | 화이트리스트 (`ACO_TIMEOUT_SECONDS` 만 허용) |
| `crypto/rand` 실패 | sentinel 없이 종료, stderr 에 경고 |
| 기존 caller 호환성 | 마이그레이션 기간 동안 fallback 지원 |
