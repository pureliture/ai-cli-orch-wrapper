# Documentation

이 디렉터리는 `ai-cli-orch-wrapper` 저장소의 문서를 **누가 왜 읽는가**에 따라
분류해 관리한다. 문서를 추가할 때는 아래 기준에 따라 적절한 위치를 선택한다.

## Classification

| 카테고리 | 답해야 하는 질문 | 주 독자 |
|----------|------------------|---------|
| [`architecture.md`](architecture.md) | 왜 이렇게 설계됐나 | 신규 기여자, 아키텍트 |
| [`contract/`](contract/) | 정확히 어떻게 동작하는가 (규범) | 구현자, 외부 통합자 |
| [`guides/`](guides/) | 어떻게 하나 (작업 단위) | 기여자, 운영자 |
| [`reference/`](reference/) | 이 필드/설정/명령의 정의는 | 운영자, 툴 사용자 |
| [`archive/`](archive/) | 과거에 어떻게 결정됐나 | 컨텍스트 추적자 |

## Navigation by Reader

### 프로젝트를 처음 접한 기여자

1. [architecture.md](architecture.md) — 저장소 구조와 핵심 설계 결정
2. [guides/contributing.md](guides/contributing.md) — 개발 환경 설정, 빌드, 테스트
3. [guides/github-workflow.md](guides/github-workflow.md) — 이슈·PR 작성 규약

### 패키지를 설치·운영하는 사용자

1. [guides/runbook.md](guides/runbook.md) — 배포·설치·일반 문제 해결
2. [reference/context-sync.md](reference/context-sync.md) — `aco sync` 동작과 변환 규칙
3. [reference/project-board.md](reference/project-board.md) — Project #3 필드·뷰 정의

### `aco` 내부 동작을 구현·확장하려는 엔지니어

1. [architecture.md](architecture.md) — 전체 그림
2. [contract/README.md](contract/README.md) — 규범 계약 문서 인덱스
3. [contract/go-node-boundary.md](contract/go-node-boundary.md) — Go/Node.js 책임 경계
4. [contract/process-execution-contract.md](contract/process-execution-contract.md) — 프로세스 실행 계약

### 과거 의사결정 컨텍스트를 추적

- [archive/](archive/) — 브레인스토밍 세션 기록, 완료된 계획 문서

## Conventions

- 파일·디렉터리명은 **kebab-case 소문자** 사용 (`contributing.md`, `github-workflow.md`)
- `archive/` 하위 항목은 **`YYYY-MM-DD-<slug>.md`** 접두어로 시점을 파일명에 명시
- 각 하위 디렉터리는 `README.md` 인덱스를 둬 탐색 경로를 제공
- 신규 외부 링크를 추가할 때는 이 `docs/README.md`를 거치거나 각 하위 `README.md`
  를 경유하도록 구성해 깊은 경로 링크의 rot을 줄인다
