---
description: "현재 GitHub Kanban 진행 상황을 GitHub Project에서 조회해 요약 표시"
---

# PM Status

현재 GitHub Kanban 이슈 상태를 GitHub Project와 issue metadata에서 조회해 요약합니다.

## 실행 흐름

1. 열린 이슈 현황 조회:
```bash
gh issue list --repo pureliture/ai-cli-orch-wrapper \
  --state open \
  --json number,title,labels,assignees \
  --limit 100
```

2. Blocked work 별도 표시:
```bash
gh issue list --repo pureliture/ai-cli-orch-wrapper \
  --state open \
  --search "blocked OR blocker OR depends" \
  --json number,title,labels,url
```

3. 다음 형식으로 요약:

```
📊 Kanban Status — <날짜>

In Progress  : N개
In Review    : N개
Blocked      : N개 ⚠️
Done (최근)  : N개

🔴 Blocked Issues:
  #N  <제목>
```

## 사용 예시

```
/pm-status
```

→ 현재 GitHub Kanban 이슈 현황을 즉시 표시합니다.
