---
"@pureliture/ai-cli-orch-wrapper": patch
---

feat(sync): `.aco/sync.yaml`에 `agents.exclude` 옵션 추가. glob으로 매칭된 agent id는
`aco sync`의 source discovery에서 제외되어 `.codex/agents/`로 생성되지 않고 manifest에도
들어가지 않는다. 기본(설정 없음)은 기존대로 모든 agent를 sync한다. 이를 통해 gitignore된
로컬 전용 agent가 디스크에 있어도 manifest가 host-independent하게 유지된다.
