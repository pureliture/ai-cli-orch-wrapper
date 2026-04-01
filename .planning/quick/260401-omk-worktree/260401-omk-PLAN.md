---
phase: quick
plan: 260401-omk-worktree
type: execute
wave: 1
depends_on: []
files_modified:
  - plans/v2.0-multi-ai-cli-bridge.md  # commit only (already exists)
autonomous: true
requirements: [V2-PREFLIGHT]
must_haves:
  truths:
    - "v1.1-stable 태그가 존재한다"
    - "rollback/v1.1 브랜치가 존재하고 docs/config-v1.md를 포함한다"
    - "feat/v2-cao-strip worktree가 ../ai-cli-orch-wrapper-v2 경로에 체크아웃돼 있다"
    - "plans/ 디렉토리가 main 브랜치에 커밋돼 있다"
  artifacts:
    - path: "plans/v2.0-multi-ai-cli-bridge.md"
      provides: "v2.0 Blueprint (committed to git)"
    - path: "../ai-cli-orch-wrapper-v2"
      provides: "feat/v2-cao-strip worktree (Step 1 작업 공간)"
  key_links:
    - from: "rollback/v1.1 브랜치"
      to: "docs/config-v1.md"
      via: "git commit on rollback/v1.1"
    - from: "feat/v2-cao-strip"
      to: "../ai-cli-orch-wrapper-v2"
      via: "git worktree add"
---

<objective>
Blueprint Step 0 (Pre-flight) 실행 + v2.0 작업용 git worktree 생성.

Purpose: v1.1 롤백 기준점을 확보하고 Step 1 이후 작업을 격리된 worktree에서 진행할 수 있도록 준비한다.
Output: v1.1-stable 태그, rollback/v1.1 브랜치(+docs/config-v1.md), feat/v2-cao-strip worktree, plans/ 커밋.
</objective>

<execution_context>
@/Users/pureliture/ai-cli-orch-wrapper/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pureliture/ai-cli-orch-wrapper/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/pureliture/ai-cli-orch-wrapper/.planning/STATE.md
@/Users/pureliture/ai-cli-orch-wrapper/plans/v2.0-multi-ai-cli-bridge.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Blueprint Step 0 — v1.1 기준점 보존</name>
  <files>plans/v2.0-multi-ai-cli-bridge.md</files>
  <action>
현재 브랜치(feat/registry-resolver-foundation)가 아니라 main 브랜치를 기준으로 Step 0를 수행한다.

1. v1.1-stable 태그가 이미 없으면 생성한다 (git tag -f는 쓰지 말 것, 이미 존재하면 skip):
   ```
   git tag | grep v1.1-stable || git tag v1.1-stable 4122ff4
   ```
   (4122ff4 = "Capture v1.1 as a shipped baseline" 커밋)

2. rollback/v1.1 브랜치 생성 (해당 커밋에서):
   ```
   git branch rollback/v1.1 4122ff4
   ```

3. rollback/v1.1 브랜치에 docs/config-v1.md 추가:
   ```
   git checkout rollback/v1.1
   mkdir -p docs
   ```
   docs/config-v1.md 내용:
   ```markdown
   # v1.x Config Schema (`.wrapper.json`)

   Captured at v1.1-stable (2026-04-01).
   This file is a reference snapshot for rollback from v2.0.

   ## Schema

   \`\`\`json
   {
     "_comment": "ai-cli-orch-wrapper config",
     "aliases": {
       "<name>": "<command>"
     },
     "roles": {
       "orchestrator": "<adapter>",
       "reviewer": "<adapter>"
     },
     "workflows": {
       "<name>": { "steps": [] }
     }
   }
   \`\`\`

   ## Field Notes

   - `aliases`: command shorthand map (removed in v2.0)
   - `roles.orchestrator` → maps to `routing.review` in v2.0
   - `roles.reviewer` → maps to `routing.adversarial` in v2.0
   - `workflows`: cao-based workflow definitions (removed in v2.0)
   ```

   ```
   git add docs/config-v1.md
   git commit -m "docs: capture v1.x .wrapper.json schema for v2.0 rollback reference"
   ```

4. main 브랜치로 복귀:
   ```
   git checkout main
   ```

5. main 브랜치에서 plans/ 디렉토리 커밋 (plans/v2.0-multi-ai-cli-bridge.md):
   ```
   git add plans/v2.0-multi-ai-cli-bridge.md
   git commit -m "docs: add v2.0 multi-ai-cli-bridge blueprint"
   ```
  </action>
  <verify>
    <automated>git tag | grep v1.1-stable && git branch | grep rollback/v1.1 && git show rollback/v1.1:docs/config-v1.md | head -3</automated>
  </verify>
  <done>
    - v1.1-stable 태그 존재
    - rollback/v1.1 브랜치 존재
    - rollback/v1.1에 docs/config-v1.md 포함
    - plans/v2.0-multi-ai-cli-bridge.md가 main에 커밋됨
    - 코드 변경 없음
  </done>
</task>

<task type="auto">
  <name>Task 2: feat/v2-cao-strip worktree 생성</name>
  <files></files>
  <action>
main 브랜치에서 Step 1 작업용 feat/v2-cao-strip 브랜치와 worktree를 함께 생성한다.

worktree 위치: 현재 레포 상위 디렉토리 (`../ai-cli-orch-wrapper-v2`).

```bash
git worktree add ../ai-cli-orch-wrapper-v2 -b feat/v2-cao-strip
```

- 위 명령이 이미 worktree가 있어 실패하면 `git worktree list`로 확인 후 skip.
- 성공하면 worktree 목록 출력으로 확인.

worktree 생성 후 내부에서 기본 상태 확인만 수행한다 (npm install 등 실행하지 않음):
```bash
git worktree list
ls ../ai-cli-orch-wrapper-v2/src/
```
  </action>
  <verify>
    <automated>git worktree list | grep feat/v2-cao-strip && ls /Users/pureliture/ai-cli-orch-wrapper-v2/src/</automated>
  </verify>
  <done>
    - `git worktree list`에 feat/v2-cao-strip 항목 존재
    - ../ai-cli-orch-wrapper-v2/ 디렉토리에 src/ 존재
    - 브랜치 feat/v2-cao-strip이 main HEAD를 기준으로 생성됨
  </done>
</task>

</tasks>

<verification>
```bash
# 전체 확인
git tag | grep v1.1-stable
git branch -a | grep -E "rollback/v1.1|feat/v2-cao-strip"
git show rollback/v1.1:docs/config-v1.md | head -1
git log main --oneline -3 | grep blueprint
git worktree list
```
</verification>

<success_criteria>
- v1.1-stable 태그: 존재 (4122ff4 기준)
- rollback/v1.1 브랜치: 존재, docs/config-v1.md 포함
- feat/v2-cao-strip 브랜치 + worktree: ../ai-cli-orch-wrapper-v2에 체크아웃
- plans/v2.0-multi-ai-cli-bridge.md: main에 커밋
- 소스 코드 변경 없음 (Step 0 invariant)
</success_criteria>

<output>
After completion, create `/Users/pureliture/ai-cli-orch-wrapper/.planning/quick/260401-omk-worktree/260401-omk-SUMMARY.md`
</output>
