# Documentation

이 디렉터리는 `ai-cli-orch-wrapper` 저장소의 문서를 **누가 왜 읽는가**에 따라
분류해 관리한다. 문서를 추가할 때는 아래 기준에 따라 적절한 위치를 선택한다.

## Quick Start

패키지를 설치해서 Claude Code command pack과 provider prompt를 배치한다.

```bash
npx @pureliture/ai-cli-orch-wrapper pack setup
npx @pureliture/ai-cli-orch-wrapper provider setup gemini
```

저장소 checkout에서 직접 확인할 때는 빌드 후 wrapper CLI를 실행한다.

```bash
npm install
npm run build
node packages/wrapper/dist/cli.js pack setup
node packages/wrapper/dist/cli.js provider setup gemini
node packages/wrapper/dist/cli.js sync --check
```

주요 운영 명령:

```bash
aco pack status
aco sync --check
aco run gemini review
aco status
aco result
```

## Navigation by Reader

### 패키지를 설치·운영하는 사용자

1. [guides/runbook.md](guides/runbook.md) — 설치·배포·일반 문제 해결
2. [reference/context-sync.md](reference/context-sync.md) — `aco sync` 동작과 변환 규칙
3. [reference/project-board.md](reference/project-board.md) — Project #3 필드·뷰 정의

### Claude Code 하네스 관리자

1. [guides/github-workflow.md](guides/github-workflow.md) — 슬래시 커맨드, 이슈·PR 운영, CI/CD
2. [architecture.md](architecture.md) — CLI 런타임, context sync, 저장소 구조
3. [contract/go-node-boundary.md](contract/go-node-boundary.md) — Go/Node.js 책임 경계

> 기여자 가이드는 Phase 1 범위에서 제외한다. 기여자 온보딩과 개발 흐름 정리는
> Phase 2에서 별도로 다룬다.

## Classification

| 카테고리                             | 답해야 하는 질문                | 주 독자               |
| ------------------------------------ | ------------------------------- | --------------------- |
| [`architecture.md`](architecture.md) | 왜 이렇게 설계됐나              | 신규 기여자, 아키텍트 |
| [`contract/`](contract/)             | 정확히 어떻게 동작하는가 (규범) | 구현자, 외부 통합자   |
| [`guides/`](guides/)                 | 어떻게 하나 (작업 단위)         | 기여자, 운영자        |
| [`reference/`](reference/)           | 이 필드/설정/명령의 정의는      | 운영자, 툴 사용자     |
| [`archive/`](archive/)               | 과거에 어떻게 결정됐나          | 컨텍스트 추적자       |

## Engineering Reference

1. [architecture.md](architecture.md) — 전체 그림
2. [contract/README.md](contract/README.md) — 규범 계약 문서 인덱스
3. [contract/go-node-boundary.md](contract/go-node-boundary.md) — Go/Node.js 책임 경계
4. [contract/process-execution-contract.md](contract/process-execution-contract.md) — 프로세스 실행 계약

## Archive

- [archive/](archive/) — 브레인스토밍 세션 기록, 완료된 계획 문서

## Remaining Documentation Phases

- **Phase 2**: 기여자 가이드 개선, `reference/context-sync.md` 심화, 문서 간 일관성 점검
- **Phase 3**: VitePress 도입, 검색·사이드바·배포 구조화

## Conventions

- 파일·디렉터리명은 **kebab-case 소문자** 사용 (`contributing.md`, `github-workflow.md`)
- `archive/` 하위 항목은 **`YYYY-MM-DD-<slug>.md`** 접두어로 시점을 파일명에 명시
- 각 하위 디렉터리는 `README.md` 인덱스를 둬 탐색 경로를 제공
- 신규 외부 링크를 추가할 때는 이 `docs/README.md`를 거치거나 각 하위 `README.md`
  를 경유하도록 구성해 깊은 경로 링크의 rot을 줄인다
