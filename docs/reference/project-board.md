# GitHub Projects V2 — Project Board 참조

## 설정 상태

- [x] Project 생성: #3 "AI-Harness-Construct"
- [x] Status 필드: Backlog / Ready / In Progress / In Review / Done
- [x] Priority 필드: P0 / P1 / P2
- [x] Size 필드: S / M / L
- [x] Target date 필드
- [x] Sprint (Iteration) 필드
- [x] GitHub UI에서 View (Active Sprint, Triage, Roadmap) 설정 완료

## 설정 안내 (남은 작업)

## 필드

| 필드 | 유형 | 옵션 |
|-------|------|---------|
| Status | Single select | Backlog, Ready, In Progress, In Review, Done |
| Priority | Single select | P0, P1, P2 |
| Size | Single select | S, M, L |
| Sprint | Iteration | 2주 주기 |
| Target date | Date | — |
| Parent issue | ProjectV2Field | Epic의 source of truth (GitHub Native) |
| epic | ProjectV2Field | **DEPRECATED** — 대신 Parent issue 사용 |

## View

| View | 유형 | Filter | Group by |
|------|------|--------|----------|
| Active Sprint | Board | `sprint:@current` | Status |
| Triage | Table | `No:label` | (none) |
| Roadmap | Table | (none) | (none) |

## ID (설정 후 채우기)

Projects V2 설정 후 다음 명령을 실행한다:

```bash
bash scripts/setup-project-ids.sh
```

또는 수동으로 확인한다:

```bash
# project number와 node ID 조회
gh project list --owner pureliture

# field ID 조회
gh project field-list <PROJECT_NUMBER> --owner pureliture --format json

# 아래 값 복사:
PM_PROJECT_NUMBER=""   # 예: 1
PM_PROJECT_ID=""       # node ID (GUID) — gh project view N --json id -q .id에서 확인
PM_STATUS_FIELD_ID=""  # Status field node ID
PM_IN_REVIEW_OPTION_ID=""  # "In Review" option node ID
```

shell rc (`.zshrc` / `.bashrc`)에 다음 값을 설정한다:

```bash
export PM_PROJECT_NUMBER="3"
export PM_PROJECT_ID="PVT_kwHOA6302M4BT5fA"
export PM_STATUS_FIELD_ID="PVTSSF_lAHOA6302M4BT5fAzhBFN48"
export PM_IN_REVIEW_OPTION_ID="961ca78f"
export PM_IN_PROGRESS_OPTION_ID="68368c4f"
export PM_DONE_OPTION_ID="b36b62fa"
export PM_PRIORITY_FIELD_ID="PVTSSF_lAHOA6302M4BT5fAzhBFN_U"
export PM_P0_OPTION_ID="65dd5d04"
export PM_P1_OPTION_ID="ed47fdcf"
export PM_P2_OPTION_ID="6eb1a525"
```

## Branch Protection 규칙 (main에서 CI를 한 번 실행한 뒤)

GitHub UI → Settings → Branches → Add rule → `main`:

- [x] status check 통과 필수: `lint`, `typecheck`, `test`, `smoke`
- [x] merge 전 branch 최신화 필수
- [x] merge 전 pull request 필수
- [x] squash merge 필수 (허용 merge 방식: Squash only)
