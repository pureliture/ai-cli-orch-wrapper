## 1. Pre-flight & Baseline Capture

- [x] 1.1 `~/Projects/ai-cli-orch-wrapper/.aco-worktrees/chore-137` 워크트리에서 `git status`와 `git log -3`로 base가 `feat/134-...@30d0755`인지 확인한다.
- [x] 1.2 `npm test -- --grep "parseGeminiUsage"` 와 `npm run typecheck`를 실행해 baseline green 상태를 확인한다.
- [x] 1.3 현재 `parseGeminiUsage` 동작 가운데 회귀 검증이 약한 케이스(빈 파일, 단일 라인, trailing newline 유/무, usage 필드 누락, malformed JSON)를 식별해 추가 테스트가 필요한 항목을 메모한다.

## 2. RED — TDD를 위한 실패하는 회귀 테스트 작성

- [x] 2.1 `packages/wrapper/tests/usage-parse-stream.test.ts`(또는 기존 usage-parse 테스트 파일 확장)에 spec `gemini-usage-telemetry`의 모든 시나리오를 1:1 매핑한 테스트를 작성한다.
  - large jsonl(1 MB 이상)에서 결과가 readFile 기반 reference 구현과 동일함을 검증
  - 단일 라인 / 다중 라인 / trailing newline 유·무 / 빈 파일 / malformed 마지막 라인 / usage 필드 누락 / size > 10 MB 가드
  - 1 MB 초과 단일 라인은 `parse_error`로 분류
- [x] 2.2 메모리 패턴 검증 테스트: 본 단계에서는 spy-기반 검증 대신 behavioral discriminator(>1 MB 단일 라인 → `parse_error`, ~1 MB 다중 라인 → `captured`, 8 KB 블록 경계 newline) 회귀로 대체한다 (design.md Decisions/D2, tdd-guide 서브에이전트 검토 결과 반영).
- [x] 2.3 `npx tsx --test packages/wrapper/tests/usage-parse-stream.test.ts` 로 11개 테스트 중 1개("1 MB+ 단일 라인 → parse_error")가 의도대로 실패하는 RED 상태를 확인한다.
- [x] 2.4 **Sub-agent dispatch (sonnet 4.6)**: `tdd-guide` 서브에이전트에 spec 시나리오 1:1 커버리지 감사를 위임. 결과: P1 누락(`Missing tmp directory`) 및 경계 케이스 2건(8 KB 블록 경계, ~800 KB 단일 라인)을 추가 반영.

## 3. GREEN — tail-block reverse read 구현

- [x] 3.1 `packages/wrapper/src/util/usage-parse.ts`에 내부 헬퍼 `readLastJsonlLine(filePath)`를 추가한다. `fs.promises.open` → `handle.read(...)` → `try/finally close` 패턴으로 끝에서부터 8 KB 블록을 역방향으로 읽어 마지막 라인 문자열을 반환한다.
- [x] 3.2 `MAX_LAST_LINE_BYTES = 1 MB` 상한을 설정하고, 초과 시 `null`을 반환해 `parseGeminiUsage`가 `parse_error`로 분류하도록 한다.
- [x] 3.3 trailing newline 처리: tail-block을 trim하고 마지막 `\n` 위치 이후 문자열을 최종 라인으로 채택한다. (빈 파일·newline-only 파일은 `unavailable`로 매핑.)
- [x] 3.4 `parseGeminiUsage`의 기존 `readFile` 경로를 `readLastJsonlLine` 호출로 교체한다. 10 MB size guard, `unavailable`/`parse_error`/`captured` 분기, `nativeSessionPath` 채움은 그대로 유지한다.
- [x] 3.5 `npm run typecheck`와 신규 + 기존 테스트가 모두 통과(GREEN)함을 확인한다. 결과: 344/344 통과 (333 기존 + 11 신규).
- [x] 3.6 **Sub-agent dispatch (sonnet 4.6)**: `typescript-reviewer` 서브에이전트가 fd 누수·UTF-8 경계·타입 안전성 검토. P1 우려는 회귀 테스트로 사전 검증됨, P2 (`Buffer.allocUnsafe`, O(N²) concat)는 task 4 단순화 단계에서 평가.

## 4. REFACTOR — 단순화 & 일관성

- [x] 4.1 `code-simplifier` 가이드를 따라 신규 코드 가독성·중복 제거·이름 일관성을 개선한다 (기능 동작은 유지).
- [x] 4.2 **Sub-agent dispatch (sonnet 4.6)**: `code-simplifier:code-simplifier` 서브에이전트가 (a) `findLastLineStart`의 도달 불가 분기 통합 + 사후조건 주석, (b) `parseGeminiUsage`의 중첩 try/catch를 단계별로 분리(stat 실패 → `continue`, readLastJsonlLine I/O 실패 → `parse_error`)했다.
- [x] 4.3 회귀 테스트가 여전히 GREEN인지 다시 확인했다. 결과: `npm test` → 344/344 pass, `npm run typecheck` → no errors.

## 5. Code Review — 보안·정합성·런타임 검증

- [x] 5.1 **Sub-agent dispatch (sonnet 4.6)**: `code-reviewer` 서브에이전트 검토 결과 P0/P1 0건, P2 2건(throw 경로 테스트 누락, stat→open TOCTOU), P3 3건. Verdict APPROVE.
- [x] 5.2 P2 두 건은 본 PR 내에서 해결: (a) 외부 `stat()` 제거 + `readLastJsonlLine` 내부 `handle.stat()` 일원화 + `FILE_TOO_LARGE` sentinel로 TOCTOU 닫음 (spec 계약 "size > 10MB → unavailable" 유지), (b) `chmod 000` 권한 거부 회귀 테스트 추가. P3-2(주석 정확도) 한 줄 정리. P3-1(경계값 1바이트 보수성), P3-3(세션 ID 매칭 테스트)는 별도 follow-up 후보.
- [x] 5.3 `npm run typecheck` clean / `npm test` 345/345 pass / `npm run test:fixtures` 5/5 / `npm run test:smoke` 11/11 / `git diff --check` 청결.

## 6. Documentation Touch-up

- [x] 6.1 `usage-parse.ts` 모듈 헤더 JSDoc에 "tail-block reverse read … MAX_LAST_LINE_BYTES(1 MB) 초과 시 parse_error" 명시. `readLastJsonlLine`/`FILE_TOO_LARGE`/상수 3종에 사후조건 코멘트 추가.
- [x] 6.2 `docs/reference/` 하위에는 parseGeminiUsage를 직접 언급하는 telemetry 문서가 없음 → task 정의("존재하지 않으면 생략")에 따라 작업 생략.

## 7. PR — stacked on #135

- [x] 7.1 첫 push 완료 (`git push -u origin chore/137-...`, force-push/amend 없음). HEAD: `5aa4588 perf(usage-parse): stream-read last JSONL line in parseGeminiUsage`.
- [x] 7.2 PR #138 생성: base=PR #135 브랜치, head=`chore/137-...`, 본문에 `Closes #137`·stacked 관계·검증 결과 명시. URL: https://github.com/pureliture/ai-cli-orch-wrapper/pull/138
- [x] 7.3 Project `Status=In Review` 설정(PR + Issue #137 모두), 라벨 동기화 완료(`type:chore`, `area:wrapper`, `origin:review`).
- [ ] 7.4 PR #135가 main에 머지되면 GitHub가 base를 main으로 자동 redirect함을 확인하고, conflict가 있으면 별도 follow-up commit으로 해결한다 (force-push 없이). — PR #135 머지 후 처리.
