---
description: "현재 스프린트 진행 상황을 GitHub Projects V2에서 조회해 요약 표시"
---

# PM Status

현재 스프린트(Iteration)의 이슈 상태를 GitHub Projects V2에서 조회해 요약합니다.

## 실행 흐름

1. 열린 이슈 현황 조회:
```bash
gh issue list --repo pureliture/ai-cli-orch-wrapper \
  --state open \
  --json number,title,labels,assignees \
  --limit 100
```

2. status:blocked 이슈 별도 표시:
```bash
gh issue list --repo pureliture/ai-cli-orch-wrapper \
  --label "status:blocked" \
  --json number,title,labels
```

3. 다음 형식으로 요약:

```
📊 Sprint Status — <날짜>

In Progress  : N개
In Review    : N개
Blocked      : N개 ⚠️
Done (이번주): N개

🔴 Blocked Issues:
  #N  <제목>
```

## 사용 예시

```
/pm-status
```

→ 현재 스프린트 이슈 현황을 즉시 표시합니다.
