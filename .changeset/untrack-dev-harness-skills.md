---
"@pureliture/ai-cli-orch-wrapper": patch
---

chore(skills): 배포 대상에서 repo 전용 `improve-codebase-architecture` 스킬을 제외한다. sync allowlist에서 빼고 생성 산출물(`.agents`/`templates`)을 추적 해제·gitignore 처리해, 빌드 시 더 이상 패키지에 번들되지 않는다. (OpenSpec 개발 툴링도 함께 추적 해제하지만 이는 비배포 surface라 패키지 영향은 없다.)
