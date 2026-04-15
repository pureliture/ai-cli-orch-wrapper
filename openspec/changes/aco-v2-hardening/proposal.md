## Why

v2 아키텍처 전환 후 basic implementation 은 완료되었으나, production 사용을 위한 stabilization 이 필요한 상태입니다. PR #12 review 에서 지적된 hardening 항목들과 multi-AI 회고에서 발견된 gap 들을 해결하여 v2 를 안정화합니다.

## What Changes

- **P0 hardening**: `cmd_delegate.go` 의 `ACO_TIMEOUT_SECONDS` env honor, `--input` value guard 개선
- **P0 hardening**: `gemini_cli.go` 가 Gemini CLI 가 지원하지 않는 `--reasoning-effort` 옵션을 전달하지 않도록 수정
- **P0 hardening**: `ACO_META` sentinel prefix collision 방지 (8바이트 랜덤 식별자, `crypto/rand` 기반)
- **P0 security**: 파일 경로 검증 (`..` 방지) 및 환경 변수 화이트리스트
- **P0 documentation**: Go/Node.js 계약 경계 문서화 (CI contract drift 검증 포함)
- **P1 testing**: Adversarial fixture 확장 (P0 hardening 테스트 우선)
- **P1 documentation**: CLAUDE.md v2 방향 갱신

## Capabilities

### New Capabilities

- `sentinel-collision-prevention`: ACO_META sentinel 의 stdout prefix 충돌 방지 (16 hex chars 랜덤 식별자)
- `go-node-contract`: Go validation 과 Node.js wrapper 간의 drift 방지 계약 명세 (CI 자동화 검증 포함)

### Modified Capabilities

- `gemini_cli-provider`: Gemini CLI 가 지원하지 않는 `--reasoning-effort` 옵션 전달 제거 (YAGNI: `effortMap.gemini_cli` 완전 삭제, dormant path 유지하지 않음)

## Impact

- **Affected code**: `cmd/aco/cmd_delegate.go`, `internal/provider/gemini_cli.go`, `internal/provider/interface.go`, 파일 경로 검증 로직
- **Affected tests**: `test/fixtures/` adversarial 케이스 확장 (P0 hardening 우선)
- **Documentation**: `docs/contract/go-node-boundary.md` 신규, `CLAUDE.md` 갱신
- **Dependencies**: 없음 (내부 hardening)
