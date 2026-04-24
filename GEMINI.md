# ai-cli-orch-wrapper

Gemini project instructions for this repository.

## Review Guidelines

리뷰 코멘트는 기본적으로 한국어로 작성한다. 단, 코드, 파일 경로, 명령어, API 이름, 라이브러리 이름은 영어 원문을 유지한다.

사소한 스타일 지적보다 merge 전에 고쳐야 할 correctness, security, runtime behavior, compatibility, CI breakage를 우선한다.

### Severity

- P0: 즉시 수정 필요. 보안 취약점, secret 노출, 데이터 손실, 빌드/배포 불가, 주요 기능 중단.
- P1: merge 전 수정 권장. 런타임 버그, contract 깨짐, 테스트 실패 가능성, 호환성 문제, 잘못된 에러 처리.
- P2: follow-up 가능. 테스트 보강, 문서 보강, 작은 UX 개선, 구조 개선.
- P3: 선택 사항. 취향에 가까운 개선, 장기 리팩터링 제안.

GitHub 코드 리뷰에서는 P0/P1 위주로 flag한다. P2/P3는 정말 의미 있는 경우에만 요약한다.

### Review Focus

- Security: secret leakage, command injection, path traversal, unsafe deserialization, auth/authz bypass, sensitive logging.
- Correctness: edge cases, null/undefined handling, error handling, data loss, race conditions.
- Runtime behavior: timeout, cancellation, retries, resource cleanup, concurrency, process/network/file-system behavior.
- Compatibility: public API, CLI behavior, config format, migration path, backward compatibility.
- Testing: changed behavior에 맞는 unit/integration/e2e test가 있는지 확인한다.
- Dependencies: 새 dependency의 필요성, 보안성, 유지보수성, bundle/build 영향 확인.
- Documentation: 사용자에게 보이는 behavior 변경이면 docs, examples, migration notes 필요 여부 확인.

### Output Expectations

각 finding은 다음 정보를 포함한다.

- 문제 위치
- 실제 영향
- 왜 문제가 되는지
- 수정 방향
- 검증 방법

확실하지 않은 추측은 blocker로 단정하지 말고 “확인 필요”로 분리한다.
