# 기여 가이드

## 사전 요구 사항

- Node.js >= 18
- npm >= 9

## 개발 환경 설정

```bash
git clone <repo>
cd ai-cli-orch-wrapper
npm install
npm run build
```

## 프로젝트 구조

```text
packages/
  wrapper/           — 공개 패키지: @pureliture/ai-cli-orch-wrapper
    src/cli.ts       — aco 진입점
    src/commands/    — pack/provider setup 명령
    src/providers/   — gemini, codex, registry
    src/session/     — 세션 생명주기
  installer/         — 내부 전환용 workspace
templates/           — `aco pack install`로 복사되는 slash command와 prompt
docs/                — 아키텍처, runbook, 기여 가이드
```

## 스크립트

| 명령 | 설명 |
|---------|-------------|
| `npm run build` | 공개 `aco` 패키지를 컴파일 |
| `npm test` | wrapper 단위 테스트 실행 |
| `npm run typecheck` | 공개 `aco` 패키지 타입 검사 |

## 테스트 실행

```bash
npm test
npm run typecheck
```

## Pull Request 체크리스트

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] 공개 패키지 또는 CLI 표면이 바뀌었다면 문서 업데이트
