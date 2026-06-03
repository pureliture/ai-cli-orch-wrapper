---
"@pureliture/ai-cli-orch-wrapper": patch
---

fix(sync): 매니페스트 `targets[].source`를 repo-relative로 정규화해 머신/worktree
절대경로 누수와 cross-checkout sync drift를 제거한다. 더불어 `aco-delegation` skill에
위임 가시화(Visibility) 규칙을 추가하고, README의 provider 아이콘을 교체한다.
