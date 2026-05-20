## Why

`parseGeminiUsage`는 최대 10 MB 크기의 Gemini 세션 JSONL 파일 전체를 `readFile`로 메모리에 로드한 뒤 split해서 마지막 라인 한 줄만 사용한다. 토큰 카운트 추출이라는 목적에 비해 메모리/CPU 비용이 과도하고, 사용자 세션 누적에 따라 jsonl 크기가 커질수록 비용이 비선형적으로 증가한다. PR #135 리뷰에서 medium severity로 지적된 항목이며 (https://github.com/pureliture/ai-cli-orch-wrapper/pull/135#discussion_r3262533229), 본 change는 후속 chore로 분리되어 단독 처리한다.

## What Changes

- `packages/wrapper/src/util/usage-parse.ts::parseGeminiUsage`의 파일 읽기 경로를 "마지막 라인만 끝에서부터 추출"하는 방식으로 교체한다.
- 기존 10 MB size guard (`fileStats.size > MAX_JSONL_BYTES → unavailable`)는 그대로 유지한다.
- `unavailable` / `parse_error` / `captured` 분기와 반환 스키마(`UsageResult`)는 전혀 변경하지 않는다.
- `nativeSessionPath`, `totalInputTokenCount`, `totalOutputTokenCount`, `modelVersion` 추출 결과는 기존 구현과 byte-for-byte 동일해야 한다.
- 새로운 회귀 테스트를 추가하여 (a) 큰 파일에서도 결과가 동일하고, (b) 메모리/IO 패턴이 전체 로드가 아님을 입증한다.

이 change는 비-BREAKING이며, public API/CLI/file format 변경이 없다.

## Capabilities

### New Capabilities

- `gemini-usage-telemetry`: Gemini CLI 세션 JSONL에서 usage(토큰 카운트, 모델) 정보를 추출하는 헬퍼의 정합성·자원 사용 invariant를 정의한다. 본 change에서 새 spec 파일 `specs/gemini-usage-telemetry/spec.md`로 추가한다.

### Modified Capabilities

(없음. `openspec/specs/aco-v2-spec.md`의 기존 requirement는 변경되지 않는다.)

## Impact

- **코드**: `packages/wrapper/src/util/usage-parse.ts` (단일 함수 `parseGeminiUsage` 내부)
- **테스트**: `packages/wrapper/tests/`에 last-line streaming 회귀 테스트 신규 추가 (예: `usage-parse-stream.test.ts` 또는 기존 `parseGeminiUsage` 테스트 파일 확장)
- **API/CLI/Config**: 영향 없음
- **의존성**: Node.js 내장 모듈만 사용 (`node:fs` 기본 stream/read APIs). 신규 npm 의존성 없음.
- **성능**: large jsonl 입력 시 peak heap 사용량 ≪ 10 MB로 감소. 작은 입력에는 영향 없음.
- **위험**: 마지막 라인 추출 로직 버그 시 `parse_error` 또는 `unavailable` 빈도가 늘 수 있으므로 회귀 테스트로 결과 동일성 검증 필수.
