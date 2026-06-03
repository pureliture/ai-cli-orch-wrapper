---
"@pureliture/ai-cli-orch-wrapper": patch
---

antigravity 위임이 `agy`를 고정 중립 작업 디렉터리(`~/.aco/agy-workspace`)에서 실행하도록 수정. 이전에는 호출 위치(임시·session·job 디렉터리 포함)를 그대로 상속해 Antigravity project 목록에 임시 경로가 무한 누적됐다. spawn 시 바이너리를 절대경로화하고, 워크스페이스 생성 실패 시 inherited cwd로 fallback해 위임이 hard-fail하지 않게 했다 (#166).
