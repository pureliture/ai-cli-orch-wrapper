## Context

`packages/wrapper/src/util/usage-parse.ts::parseGeminiUsage`는 Gemini CLI native session JSONL을 읽어 마지막 라인의 usage 필드(`totalInputTokenCount`, `totalOutputTokenCount`, `modelVersion`)를 추출한다. 현재 구현은:

```ts
const fileStats = await stat(filePath);
if (fileStats.size > MAX_JSONL_BYTES) {     // 10 MB guard
  return { usageStatus: 'unavailable' };
}
const content = await readFile(filePath, 'utf8');   // ⬅ 전체 파일 로드
const lines = content.trim().split('\n').filter(Boolean);
const lastLine = lines[lines.length - 1];
```

10 MB 가드가 있으나, 정상 범위 안에서도 1~9 MB 파일을 통째로 메모리에 적재한 뒤 split/filter한다. Gemini CLI는 한 세션의 모든 turn을 누적해서 동일 파일에 append하므로 시간이 지날수록 파일이 커진다. 본 코드는 ask 한 번당 한 번 호출되고, 결과적으로 buffer + lines 배열로 peak heap이 파일 크기의 2~3배까지 증가한다.

본 change는 PR #135 (`feat/134-harden-aco-runtime-evidence-artifacts-and-delegate-surface`) review feedback(https://github.com/pureliture/ai-cli-orch-wrapper/pull/135#discussion_r3262533229)의 후속 chore이며, base branch는 `main`이 아니라 PR #135 브랜치이다. #135가 merge되기 전까지는 stacked PR로 운용된다.

## Goals / Non-Goals

**Goals:**

- `parseGeminiUsage`의 파일 읽기 경로를 "마지막 라인만 끝에서부터 추출"로 교체한다. peak heap이 파일 크기에 비례하지 않게 한다.
- 기존 관찰 가능한 동작(`UsageResult` 스키마, 분기, 파싱 결과)을 byte-for-byte 보존한다.
- `MAX_JSONL_BYTES = 10 MB` 사이즈 가드는 그대로 유지한다.
- 회귀 테스트로 (a) 결과 동일성과 (b) 메모리 패턴이 더 이상 전체 로드가 아님을 입증한다.

**Non-Goals:**

- `parseCodexUsage`의 구현(현재 `unavailable` 반환) 변경은 본 change 범위 밖이다.
- 다른 telemetry 경로(`ask-ledger-provenance` 등)의 수정은 범위 밖이다.
- Streaming 라이브러리(`split2`, `n-readlines` 등) 신규 의존성 도입은 하지 않는다.
- JSONL 포맷 자체의 변경, schema versioning은 다루지 않는다.

## Decisions

### D1. last-line 추출 알고리즘: tail-block reverse read

**선택**: Node.js 내장 `fs.open` + `read(fd, buf, offset, length, position)`로 파일 끝에서부터 고정 크기 블록(예: 8 KB)을 역방향으로 읽어 가장 마지막 newline 이후 데이터를 모은다. 이 데이터를 trim해서 `JSON.parse`로 넘긴다.

**대안**:

1. **`split2` / `readline.createInterface` 전체 순회**: O(N) IO이며 마지막 라인까지 모두 디코드한다. peak heap은 줄지만 IO 비용은 여전히 선형이다.
2. **`n-readlines` 패키지**: 동기 reverse iteration을 제공하지만 새 의존성을 추가해야 한다. 본 change의 Non-Goal과 충돌.
3. **`exec(["tail", "-n", "1", file])`**: POSIX `tail`에 의존한다. 본 repo는 macOS/Linux만 지원하므로 가능하지만, child process spawn 비용과 비-Node 의존이 추가된다.

**선택 이유**: tail-block reverse read는 (a) 외부 의존성이 없고, (b) 마지막 라인 길이만큼만 디코드하므로 IO와 메모리가 둘 다 O(line length)이며, (c) 기존 size guard와 자연스럽게 결합된다. 트레이드오프는 구현이 한 단계 복잡해진다는 점.

### D2. 블록 크기와 라인 길이 상한

**선택**: 초기 블록 크기 8 KB. 마지막 라인에 newline이 없을 경우(파일 끝에 trailing newline이 없는 케이스) 블록을 추가로 읽어 합치되, 누적 크기가 **`MAX_LAST_LINE_BYTES = 1 MB`** 를 초과하면 `parse_error`를 반환한다.

**대안**: 블록 크기를 64 KB로 키워 한 번에 끝내기 — 메모리 풋프린트가 늘어나고, 일반 Gemini turn 라인 크기(수 KB)를 고려하면 과도하다.

**선택 이유**: 일반 케이스에서는 단일 8 KB 블록 한 번의 read syscall로 끝난다. 상한 1 MB는 `MAX_JSONL_BYTES`(10 MB)보다 작아 메모리 안전성을 보장하고, 비정상적으로 큰 단일 라인을 거부한다.

### D3. trailing newline 처리

JSONL 파일은 마지막 라인이 newline으로 끝날 수도, 끝나지 않을 수도 있다. tail-block은 끝부터 읽으므로 trailing `\n`을 trim한 뒤 마지막 `\n` 위치를 찾는다. 그 위치 이전이 두 번째 마지막 라인, 이후가 진짜 마지막 라인이다. 이는 기존 `content.trim().split('\n').filter(Boolean)` 의미와 일치한다.

### D4. 파일 사이즈 가드 위치

기존 `stat` → `size > MAX_JSONL_BYTES` 검사는 read 이전에 그대로 둔다. 가드를 통과한 후에만 tail-block read를 시작한다. 빈 파일(`size === 0`) 도 기존과 동일하게 `unavailable`로 처리한다.

### D5. 에러 분류 보존

| 상황 | 기존 반환 | 새 구현 반환 |
|---|---|---|
| tmp 디렉토리 미존재 | `unavailable` | 동일 |
| chats 디렉토리 미존재 | continue | 동일 |
| 파일 size > 10 MB | `unavailable` | 동일 |
| 파일 size === 0 | `unavailable` | 동일 |
| 마지막 라인이 valid JSON이 아님 | `parse_error` | 동일 |
| 마지막 라인이 valid JSON이지만 usage 필드 없음 | `parse_error` | 동일 |
| 마지막 라인이 1 MB 초과 (신규) | (해당 없음) | `parse_error` |
| 정상 | `captured` | 동일 |

마지막 라인 1 MB 초과는 기존 구현에서는 도달하지 못했던 상태(전체 로드되었지만 라인 분해가 가능했음)이지만, tail-block 알고리즘 안전 상한이므로 보수적으로 `parse_error`로 분류한다.

## Risks / Trade-offs

- **마지막 라인 추출 버그 → 결과 불일치**: 회귀 테스트로 동일 입력에 대한 동일 출력을 검증한다. 다양한 JSONL 패턴(빈 파일, 단일 라인, 다중 라인, trailing newline 유/무, 1 MB 경계)을 포함한다. → **Mitigation**: 기존 `parseGeminiUsage` 동작을 입력별로 capture하는 회귀 테스트 추가.
- **fd leak**: `open`/`read`/`close` 수동 관리는 누수 위험이 있다. → **Mitigation**: `try/finally`로 항상 `close(fd)`. 또는 `fs.promises.open(...).then(handle => handle.read(...).finally(handle.close))` 패턴 사용.
- **partial UTF-8 codepoint 분할**: 블록 경계에서 멀티바이트 UTF-8 문자가 잘릴 수 있다. JSONL의 ASCII-heavy 특성상 드물지만, 마지막 라인 디코드에서만 발생할 가능성이 있는데 우리는 "마지막 newline 이후"만 디코드하므로 문제 영역이 좁다. → **Mitigation**: 디코드 시점은 라인 경계가 확정된 후이므로 단일 디코드로 처리하고, 라인 내부 멀티바이트는 자연히 보존된다.
- **테스트가 large file을 만들기 비용**: 1~9 MB 파일을 매 테스트마다 생성하는 것은 느리다. → **Mitigation**: 큰 사이즈는 한 번만 만들거나 `sparse` write 사용. 일반 동작 검증은 작은 fixture로 처리.

## Migration Plan

본 change는 내부 헬퍼 함수 한 개의 구현만 교체한다. 별도의 데이터 마이그레이션, 설정 변경, 배포 단계는 없다. 머지 후 ask 호출 시 자동으로 새 경로가 사용된다. 롤백은 단일 commit revert로 충분하다.

## Open Questions

- (해결됨) 신규 의존성 도입 여부: **하지 않는다** — Node.js 내장 `fs.open`/`read`만 사용.
- (해결됨) BREAKING 여부: **아님** — `UsageResult` 스키마와 모든 분기가 보존된다.
- (Open) 마지막 라인 1 MB 상한이 적절한가? 현재 합의: P2 chore의 보수적 안전 상한으로 시작. 실사용 데이터로 너무 작다는 신호가 보이면 별도 follow-up에서 조정한다.
