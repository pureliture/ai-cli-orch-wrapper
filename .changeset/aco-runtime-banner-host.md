---
"@pureliture/ai-cli-orch-wrapper": minor
---

aco 위임 런타임을 host UX에 노출: `aco ask`에 `--runtime-banner` 추가 — 비-TTY host(Claude `/aco`, Codex `$aco`)로 실행될 때 런타임 롤업 대시보드를 ANSI-free 블록으로 stdout에 1회 출력해 host가 사용자에게 activation 배너로 표시한다. 플래그가 없으면 stdout 기본 동작은 변하지 않는다. 함께 추가된 `--host claude|codex`는 배너 헤더 아이콘과 `Host:` 줄을 위임 host에 맞게 표시한다(표시 전용, 기본 claude). `/aco`·`$aco` 커맨드 본문이 두 플래그를 자동으로 부착한다.
