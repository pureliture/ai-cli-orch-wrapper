## ADDED Requirements

### Requirement: parseGeminiUsage SHALL extract usage from the last JSONL record without loading the entire file

`parseGeminiUsage`는 Gemini 세션 JSONL 파일에서 토큰 카운트와 모델 정보를 추출할 때, 마지막 JSONL 레코드만 디스크에서 읽어야 한다(SHALL). 전체 파일 내용을 메모리에 적재(`readFile` → `split('\n')` 전체 라인 분해)해서는 안 된다(MUST NOT). peak heap 사용량은 입력 파일 크기에 선형 비례해서는 안 된다(MUST NOT).

#### Scenario: Large JSONL is parsed without full in-memory load

- **WHEN** parseGeminiUsage가 1 MB 이상 JSONL 파일에 대해 호출된다
- **THEN** 파일을 통째로 메모리에 로드하지 않고, 마지막 라인만 추출한다
- **AND** 반환된 `UsageResult`는 동일 입력에 대해 기존 readFile 기반 구현과 동일한 `inputTokens`, `outputTokens`, `model`, `nativeSessionPath` 값을 가진다

#### Scenario: Small JSONL still returns last-line usage

- **WHEN** parseGeminiUsage가 단일 라인 또는 수 KB JSONL 파일에 대해 호출된다
- **THEN** 마지막 JSONL 라인의 `totalInputTokenCount`/`totalOutputTokenCount`/`modelVersion`을 정상적으로 파싱한다

### Requirement: parseGeminiUsage SHALL preserve the existing UsageResult contract

`parseGeminiUsage`는 `UsageResult` 스키마(`usageStatus`, `model`, `inputTokens`, `outputTokens`, `nativeSessionPath`), 분기 (`captured` / `unavailable` / `parse_error`), 그리고 파일 미발견·디렉토리 미존재·빈 파일 처리 동작을 본 change 이전과 동일하게 유지해야 한다(MUST). 동일 입력에 대해 기존 readFile 기반 구현과 동일한 결과를 반환해야 한다(SHALL).

#### Scenario: Missing tmp directory returns unavailable

- **WHEN** `~/.gemini/tmp/`가 존재하지 않는다
- **THEN** parseGeminiUsage는 `{ usageStatus: 'unavailable' }`을 반환한다

#### Scenario: Empty JSONL returns unavailable

- **WHEN** parseGeminiUsage 대상 JSONL 파일이 비어 있다
- **THEN** parseGeminiUsage는 `{ usageStatus: 'unavailable' }`을 반환한다

#### Scenario: Malformed last line returns parse_error with nativeSessionPath

- **WHEN** parseGeminiUsage 대상 파일의 마지막 라인이 valid JSON이 아니다
- **THEN** parseGeminiUsage는 `{ usageStatus: 'parse_error', nativeSessionPath: <path> }`을 반환한다

#### Scenario: Last line lacks usage fields returns parse_error

- **WHEN** 마지막 라인 JSON이 valid이지만 `totalInputTokenCount`, `totalOutputTokenCount`, `modelVersion` 중 어느 것도 포함하지 않는다
- **THEN** parseGeminiUsage는 `{ usageStatus: 'parse_error', nativeSessionPath: <path> }`을 반환한다

### Requirement: parseGeminiUsage SHALL retain the 10 MB size guard

`parseGeminiUsage`는 10 MB(`MAX_JSONL_BYTES = 10 * 1024 * 1024`) 초과 파일을 처리해서는 안 되며(MUST NOT), streaming 도입 후에도 그러한 파일에 대해 `{ usageStatus: 'unavailable' }`을 반환해야 한다(SHALL). 이 가드는 디스크 I/O 시간이 비정상적으로 길어지거나 손상된 거대한 로그 파일을 안전하게 회피하기 위해 유지된다.

#### Scenario: File exceeding 10 MB is rejected as unavailable

- **WHEN** parseGeminiUsage 대상 파일 크기가 `MAX_JSONL_BYTES`를 초과한다
- **THEN** parseGeminiUsage는 파일을 읽지 않고 `{ usageStatus: 'unavailable' }`을 반환한다
