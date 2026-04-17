---
description: "레이블 없는 이슈를 조회하고 type/area/priority 레이블을 제안해 일괄 분류"
---

# PM Triage

레이블이 없는 GitHub Issues를 조회하고, 각 이슈를 분석해 type/area/priority 레이블을 제안합니다.

## 실행 흐름

1. 레이블 없는 이슈 조회:
```bash
gh issue list --repo pureliture/ai-cli-orch-wrapper \
  --json number,title,body,labels \
  --limit 100 \
  --jq '[.[] | select(.labels | length == 0)]'
```

2. 각 이슈의 제목과 본문을 분석해 다음 레이블 조합을 제안:
   - `type:*` — epic / feature / task / bug / spike / chore 중 하나
   - `area:*` — wrapper / installer / templates / ci / ops 중 해당하는 것
   - 우선순위 — p0 / p1 / p2 중 하나

3. 이슈별로 제안 내용을 표시하고 사용자 확인 후 적용:
```bash
gh issue edit <number> --repo pureliture/ai-cli-orch-wrapper \
  --add-label "type:task,area:wrapper,p2"
```

## 사용 예시

```
/pm-triage
```

→ 미분류 이슈 목록과 레이블 제안을 표시합니다.
→ 각 이슈별로 적용 여부를 확인합니다.
