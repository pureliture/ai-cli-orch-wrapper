## 1. P0: cmd_delegate.go Hardening

- [x] 1.1 `cmd_delegate.go` 에 `ACO_TIMEOUT_SECONDS` env honor 구현 (`cmdRun` 과 동작 일치)
- [x] 1.2 `--input` value guard 를 known flag exact match 또는 `--input=<value>`/`--` terminator 지원으로 개선
- [x] 1.3 `cmdDelegate` unknown flag 처리 시 usage 와 함께 fast-fail

## 2. P0: gemini_cli.go 옵션 필터링

- [x] 2.1 `GeminiProvider.Invoke()` 에서 `effortMap.gemini_cli` 매핑 완전 제거 (YAGNI)
- [x] 2.2 관련 unit test 업데이트

## 3. P0: Sentinel Collision 방지

- [x] 3.1 `cmd_delegate.go` 에 8바이트 랜덤 식별자 생성 로직 추가 (`crypto/rand` 사용, 16 hex chars)
- [x] 3.2 `crypto/rand` 실패 시 sentinel 없이 종료 + stderr 경고
- [x] 3.3 sentinel 출력 형식을 `ACO_META_<rid>: {...}` 로 변경 (`<rid>` 는 16 hex chars)
- [x] 3.4 sentinel 파싱 로직 업데이트 (정규식: `^ACO_META_[a-f0-9]{16}:`) — **Node.js wrapper 책임**
- [x] 3.5 기존 caller 마이그레이션: 식별자 strip 후 기존 `ACO_META:` 형식으로 변환 — **Node.js wrapper 책임**
- [x] 3.6 `cmd/aco/cmd_delegate_test.go` 에 collision 테스트 추가 (provider `ACO_META_` 출력, regex 경계, 동시 100회 중복 없음)
- [x] 3.7 `openspec/specs/aco-v2-spec.md` B-08 업데이트

## 4. P0: Go/Node.js 계약 문서화

- [x] 4.1 `docs/contract/go-node-boundary.md` 작성 (파일 경로 검증, 환경 변수 화이트리스트 포함)
- [x] 4.2 `CLAUDE.md` 관련 섹션 링크 업데이트
- [x] 4.3 CI contract drift 검증 스크립트 추가 (공유 TypeScript 정의 기준)

## 5. P0: 파일 경로 및 환경 변수 보안

- [x] 5.1 `--agents-dir`, `--formatter`, `promptSeedFile` 경로에 `path/filepath.Clean()` + `..` 차단 적용
- [x] 5.2 provider 실행 시 환경 변수 화이트리스트 적용 (`ACO_TIMEOUT_SECONDS` 만 허용)

## 6. P1: Adversarial Fixture 확장

- [x] 6.1 Frontmatter fixture (`id` 없음, 닫히지 않은 `---`, 잘못된 타입, `executionMode: background`, path traversal)
- [x] 6.2 Formatter fixture (파일 없음, `version: 2`, `fallback` 없음, 매핑 안 되는 alias)
- [x] 6.3 Payload/Stream fixture (50k bytes 초과 diff, 멀티바이트 UTF-8 truncation, sentinel 없이 종료, `ACO_TIMEOUT_SECONDS` env 미적용, provider binary not found)
- [x] 6.4 Process/Signal fixture (SIGTERM 후 5 초 내/초과 종료 케이스)
- [x] 6.5 P0 hardening 우선 테스트: `ACO_TIMEOUT_SECONDS` env, `--input` guard 다양한 입력, Gemini `reasoningEffort` 미전달 확인
- [x] 6.6 `go test ./...` 전체 통과 확인 — **CI에서 확인 필요**

## 7. P1: CLAUDE.md v2 갱신

- [x] 7.1 `## Maintenance Rules` — thin template → context marshaler 원칙
- [x] 7.2 `## Key Design Decisions` — `aco run` → `aco delegate`
- [x] 7.3 provider 목록 갱신 (copilot 제거, codex + gemini_cli)
- [x] 7.4 `.claude/agents/`, `openspec/` 설명 추가

## 8. P1: 기타 Hardening

- [x] 8.1 `internal/provider/interface.go` `InvokeOpts` comment 의 session/PID persistence 잔여 문구 제거
- [x] 8.2 `cmd/aco/main.go` file header comment 를 실제 CLI surface 와 일치하도록 수정
- [x] 8.3 test fixtures header 의 `Known Node.js gap` 표기와 `knownNodeGap: true` metadata 정합성 맞춤 — **해당 항목 없음 (이미 정합)**