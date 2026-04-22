# docs/contract/

`aco` CLI의 계약 문서 모음. 각 문서는 외부 기여자가 런타임 동작을 코드 읽기 없이 이해할 수 있도록 규범(normative) 사양을 정의한다.

## 문서 목록

| 문서 | 범위 | 상태 |
|------|------|------|
| [process-execution-contract.md](process-execution-contract.md) | `aco run`/`aco delegate`의 프로세스 생성, 스트리밍, 취소, 종료 | Normative |
| [go-node-boundary.md](go-node-boundary.md) | Go 바이너리와 Node.js 래퍼 간 책임 경계 | Normative |

## 아카이브

| 문서 | 이유 |
|------|------|
| [_archive/blocking-execution-contract.md](_archive/blocking-execution-contract.md) | `process-execution-contract.md`로 대체됨. ccg-workflow 중심으로 작성되어 aco 구현 중심으로 재작성함. |

## 작성 규칙

- "호환성"이나 "호환되다"라는 표현을 사용하지 않는다.
- 코드의 관측 가능한 동작만을 기술한다.
- 외부 레퍼런스(ccg-workflow 등)는 §참조로 격리한다.
- "제외 범위"는 명시적으로 기술하여 문서의 경계를 명확히 한다.
