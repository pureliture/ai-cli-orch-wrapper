---
description: "미분류 이슈를 조회하고 canonical label 및 Project Priority를 제안해 분류"
---

# PM Triage

미분류 GitHub Issues를 조회하고, 각 이슈를 분석해 durable label과 Project `Priority` field 값을 제안합니다. Priority는 Project field가 source of truth이며 label로 추가하지 않습니다.

## 실행 흐름

1. label 또는 Project 분류가 부족한 이슈 조회:
```bash
gh issue list --repo pureliture/ai-cli-orch-wrapper \
  --json number,title,body,labels \
  --limit 100 \
  --jq '[.[] | select(.labels | length == 0)]'
```

2. 각 이슈의 제목과 본문을 분석해 다음 값을 제안:
   - `type:*` label — `type:epic`, `type:task`, `type:bug`, `type:chore` 중 하나
   - `area:*` label — affected area가 명확할 때만 적용
   - `origin:review` label — PR review follow-up에서 생성된 작업에만 적용
   - Project `Priority` field — `P0`, `P1`, `P2` 중 하나. 근거가 부족하면 unset으로 두고 triage 필요를 보고

3. 이슈별로 제안 내용을 표시하고 사용자 확인 후 durable label만 적용:
```bash
gh issue edit <number> --repo pureliture/ai-cli-orch-wrapper \
  --add-label "type:task,area:wrapper"
```

4. Project item이 있으면 `Priority` field만 업데이트:
```bash
gh project item-edit \
  --project-id "$PM_PROJECT_ID" \
  --id "<item-id>" \
  --field-id "$PM_PRIORITY_FIELD_ID" \
  --single-select-option-id "$PM_P1_OPTION_ID"
```

## 사용 예시

```
/pm-triage
```

→ 미분류 이슈 목록과 canonical 분류 제안을 표시합니다.
→ 각 이슈별로 적용 여부를 확인합니다.
