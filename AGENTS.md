# ai-cli-orch-wrapper

Codex project instructions for this repository. Claude Code receives the matching
repo-level instructions from `CLAUDE.md`.

## 공통 작업 원칙

이 repo의 세부 규칙은 이 파일의 worktree/context-sync 정책과 root `~/.openclaw/AGENTS.md`의 공통 원칙을 함께 따른다.

- 구현 전에 모호한 가정, 가능한 해석, 위험한 변경 범위를 먼저 드러낸다.
- 요청받은 문제를 해결하는 최소 변경을 우선하고, 단일 사용처를 위한 추상화나 미래 기능을 만들지 않는다.
- provider-neutral wrapper 구조와 context-sync surface 경계를 따른다. 관련 없는 리팩터링, 포맷 변경, dead code 삭제는 하지 않는다.
- 모든 변경 라인은 사용자 요청, runtime compatibility, 또는 검증 필요성과 직접 연결되어야 한다.
- 비사소한 변경은 성공 기준과 검증 명령을 먼저 정하고, 완료 전에 실제 결과를 확인한다.
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`의 generated block은 sync contract를 먼저 확인하고, 불가피할 때만 손으로 수정한다.

## Codex-Specific Guidance

- Use the local `.agents/skills/*/SKILL.md` files when a task names a skill or clearly matches one.
- For GitHub PM tasks, use `github-kanban-ops` for policy details. Codex `$gh-*` command alias UX is deferred to a future Codex-only design.
- Do not create `.codex/skills/` copies unless Codex runtime or packaging proves they are required.
- Treat `AGENTS.md` as the root instruction surface for Codex, but keep durable workflow policy in skills and docs.

## Worktree Policy

All write tasks must be performed in a dedicated Git worktree and task branch.

This is a mandatory rule. If the current directory is the main/local checkout, do not modify files. First create or switch to a dedicated task worktree.

Rules:

- Do not modify the main/local checkout for implementation work.
- Use a dedicated branch per task: `codex/{ticket-id}-{short-title}`.
- Keep each task isolated to its own worktree.
- Do not reuse the same branch across multiple worktrees.
- Read-only investigation may run in the local checkout.
- Dependency or lockfile changes require explicit review before merge.
- When finished, report:
  - worktree path
  - branch name
  - changed files
  - test commands and results
  - PR URL if created

<!-- BEGIN ACO GENERATED CONTEXT -->
## CLAUDE.md

# ai-cli-orch-wrapper

Claude Code project instructions for this repository. Codex receives the matching
repo-level instructions from `AGENTS.md`.

## 공통 작업 원칙

이 repo의 세부 규칙은 이 파일의 worktree/context-sync 정책과 root `~/.openclaw/AGENTS.md`의 공통 원칙을 함께 따른다.

- 구현 전에 모호한 가정, 가능한 해석, 위험한 변경 범위를 먼저 드러낸다.
- 요청받은 문제를 해결하는 최소 변경을 우선하고, 단일 사용처를 위한 추상화나 미래 기능을 만들지 않는다.
- provider-neutral wrapper 구조와 context-sync surface 경계를 따른다. 관련 없는 리팩터링, 포맷 변경, dead code 삭제는 하지 않는다.
- 모든 변경 라인은 사용자 요청, runtime compatibility, 또는 검증 필요성과 직접 연결되어야 한다.
- 비사소한 변경은 성공 기준과 검증 명령을 먼저 정하고, 완료 전에 실제 결과를 확인한다.
- `AGENTS.md`, `CLAUDE.md`의 generated block은 sync contract를 먼저 확인하고, 불가피할 때만 손으로 수정한다. (`GEMINI.md`는 Phases 1-3 마이그레이션으로 제거됨)

## Repo Structure

This repo is an npm workspace with the following layout:

- `packages/wrapper/` — `@pureliture/ai-cli-orch-wrapper` runtime. Owns the `aco` CLI, provider interface, provider implementations, provider registry, sync engine, and session/task/output lifecycle.
- `packages/installer/` — installer package for setup flows and install-time entrypoints used by `aco-install`.
- `templates/commands/` — packaged Claude slash command sources. Keep each file in parity with the matching `.claude/commands/` file when behavior changes.
- `.claude/commands/` — repo-local Claude slash commands used by maintainers.
- `.claude/skills/` — Claude-local skill sources and compatibility copies.
- `.agents/skills/` — shared Codex/Antigravity skill surface for explicitly allowed ACO-owned shared policy/reference skills only. `github-kanban-ops` is the canonical GitHub PM policy source. `gh-*` command-alias skills, OpenSpec skills, and Superpowers skills are not mirrored here.
- `.codex/agents/` — Codex custom agent definitions generated or maintained for local workflows.
- `.gemini/commands/` and `.gemini/agents/` — 이 디렉터리는 Phases 1-3 마이그레이션으로 더 이상 `aco sync` 생성 대상이 아니다. 잔여 파일이 있다면 Gemini provider 제거 후 정리가 필요하다.
- `docs/` — architecture, contracts, guides, reference docs, phase plans, and archived planning material.
- `openspec/` — OpenSpec proposals, specs, design docs, and task lists.

## Maintenance Rules

- Preserve provider-neutral behavior in `packages/wrapper/src/`; add provider-specific code only behind the provider abstraction.
- New providers implement `IProvider` in `packages/wrapper/src/providers/<name>.ts` and register in `registry.ts`.
- Keep `.claude/commands/gh-*.md` and `templates/commands/gh-*.md` byte-for-byte aligned unless an intentional compatibility exception is documented.
- Keep `.agents/skills/github-kanban-ops/` and `.claude/skills/github-kanban-ops/` aligned when changing shared GitHub PM policy or scripts.
- Keep Codex `$gh-*` wrapper skills intentionally thin; workflow policy belongs in `github-kanban-ops`.
- Do not reintroduce sprint, story, or spike concepts into the GitHub PM harness.
- Do not encode workflow state or priority in labels. GitHub Project `Status` and `Priority` fields are the source of truth.
- Before finishing behavior changes, run the most specific validation available, then broader tests if practical.

## GitHub Kanban Workflow

Use `github-kanban-ops` as the canonical model for repository PM automation.

- Allowed issue types: `epic`, `task`, `bug`, `chore`.
- Durable labels only: `type:*`, `area:*`, `origin:review`.
- Forbidden labels/concepts: `status:*`, `sprint:*`, `p0`/`p1`/`p2`, `size:*`, `type:feature`, `type:story`, `type:spike`.
- Claude entrypoints: `/gh-issue`, `/gh-start`, `/gh-pr`, `/gh-pr-followup`.
- Codex entrypoints: `$gh-issue`, `$gh-start`, `$gh-pr`, `$gh-pr-followup`.
- `$github-kanban-ops` is for direct policy/workflow reference, not the normal command-like UX.
- PR body prose and checklist item descriptions are Korean by default; keep `Closes #N`, headings, labels, file paths, and command names in English.

## Context Sync

`aco sync`는 Claude 프로젝트 컨텍스트를 Codex 대상 표면으로 변환한다. manifest 형식은 v5다. Gemini provider는 Phases 1-3 마이그레이션으로 제거되었으며 `GEMINI.md`는 더 이상 생성 대상이 아니다.

- Source order starts with root `CLAUDE.md`, then optional `.claude/CLAUDE.md`, `.claude/rules/*.md`, skills, agents, and hooks.
- Codex project instructions live in root `AGENTS.md`.
- Shared skills live in `.agents/skills/<skill>/`, but only explicitly allowed ACO-owned skills are synced. `.agents/skills/` is not a mirror of `.claude/skills/`.
- Do not hand-maintain `.codex/skills/` copies unless the runtime requirement is proven.
- Use `aco sync --check` to detect stale generated targets and `aco sync --force` only when overwriting managed drift is intentional.
- Use `aco sync --check --strict` to fail on duplicate provider-surface warnings in CI.

## Codex `$aco` Entrypoint

Codex는 `$aco`를 통해 ACO delegation을 실행할 수 있다. 이는 Claude의 `/aco` slash command와 동일한 consent-gated delegation 흐름을 Codex 세션에서 미러링한다.

- **`$aco`**: `aco ask` 기반 consent-gated delegation 실행. peers = `antigravity`/`mock`. 실행에는 `--yes` 동의가 필요하다.
- Claude entrypoints: `/aco` (단일 generic delegation command)
- Codex entrypoints: `$aco` (위와 동일한 `aco ask` 흐름, Codex 세션 내에서 실행)
- `$aco`는 task-specific subcommand를 만들지 않는다. task 내용은 자연어 task text, CLI flag, preset으로 전달한다.
- `/aco` command file: `.claude/commands/aco.md`. Codex용 별도 파일은 없다. 위임 정책은 `.claude/skills/aco-delegation/SKILL.md`가 담당한다.

## Commit Message Policy

Use the repository commit template at `.gitmessage` and the Korean commit-writing prompt at `docs/guides/commit-message-prompt.md` whenever an AI assistant drafts or creates commits.

- Commit messages must use a title plus body format.
- The title must follow conventional commit style such as `fix(tests): replace echo pipeline with herestrings`.
- The body must explain the why, what changed, and affected files or areas in Korean by default.
- When an AI assistant creates a commit, it must follow `docs/guides/commit-message-prompt.md`.
- Commit messages must include contributor trailers for every AI CLI and model used in development so GitHub Contributors can show the CLI/model identities where GitHub recognizes them.
- If a CLI or model has no GitHub-recognized identity, still include explicit `AI-CLI:` and `AI-Model:` trailers in addition to any available `Co-authored-by:` trailers.
  - **How to Add AI as a Co-Author (Manual Method):** Add the corresponding line to the end of the commit message, usually after a blank line:
  - **Claude Code:** `Co-authored-by: Claude Code {session수행중인 모델명} <noreply@anthropic.com>`
  - **Codex:** `Co-authored-by: Codex {session수행중인 모델명} <noreply@sourcegraph.com>`
  - **Gemini CLI:** `Co-authored-by: Gemini CLI {session수행중인 모델명} <gemini-code-assist@google.com>`
  - 각 CLI에서 커밋이 발생할 때 반드시 위 형식에 맞는 `Co-authored-by` 트레일러가 추가되어야 한다.

## Review Guidelines

리뷰 코멘트는 기본적으로 한국어로 작성한다. 단, 코드, 파일 경로, 명령어, API 이름, 라이브러리 이름은 영어 원문을 유지한다.

사소한 스타일 지적보다 merge 전에 고쳐야 할 correctness, security, runtime behavior, compatibility, CI breakage를 우선한다.

### Severity

- P0: 즉시 수정 필요. 보안 취약점, secret 노출, 데이터 손실, 빌드/배포 불가, 주요 기능 중단.
- P1: merge 전 수정 권장. 런타임 버그, contract 깨짐, 테스트 실패 가능성, 호환성 문제, 잘못된 에러 처리.
- P2: follow-up 가능. 테스트 보강, 문서 보강, 작은 UX 개선, 구조 개선.
- P3: 선택 사항. 취향에 가까운 개선, 장기 리팩터링 제안.

GitHub 코드 리뷰에서는 P0/P1 위주로 flag한다. P2/P3는 정말 의미 있는 경우에만 요약한다.

### Review Focus

- Security: secret leakage, command injection, path traversal, unsafe deserialization, auth/authz bypass, sensitive logging.
- Correctness: edge cases, null/undefined handling, error handling, data loss, race conditions.
- Runtime behavior: timeout, cancellation, retries, resource cleanup, concurrency, process/network/file-system behavior.
- Compatibility: public API, CLI behavior, config format, migration path, backward compatibility.
- Testing: changed behavior에 맞는 unit/integration/e2e test가 있는지 확인한다.
- Dependencies: 새 dependency의 필요성, 보안성, 유지보수성, bundle/build 영향 확인.
- Documentation: 사용자에게 보이는 behavior 변경이면 docs, examples, migration notes 필요 여부 확인.

### Output Expectations

각 finding은 다음 정보를 포함한다.

- 문제 위치
- 실제 영향
- 왜 문제가 되는지
- 수정 방향
- 검증 방법

확실하지 않은 추측은 blocker로 단정하지 말고 “확인 필요”로 분리한다.

## Validation

Common checks:

```bash
npm test
npm run typecheck
npm run test:fixtures
npm run test:smoke
git diff --check
```

Targeted harness checks:

```bash
cmp .claude/commands/gh-pr.md templates/commands/gh-pr.md
cmp .agents/skills/github-kanban-ops/scripts/make_issue_body.py .claude/skills/github-kanban-ops/scripts/make_issue_body.py
bash -n scripts/pm-hook.sh scripts/setup-github-labels.sh scripts/setup-github-project.sh scripts/setup-project-ids.sh
```

## Key References

- `docs/architecture.md` — system architecture and context sync overview.
- `docs/contract/go-node-boundary.md` — Go/Node.js responsibility boundary.
- `docs/reference/context-sync.md` — sync target surfaces and managed block behavior.
- `docs/reference/project-board.md` — GitHub Project field and option contract.
- `docs/guides/github-workflow.md` — issue/PR authoring and Kanban workflow guide.

## Excluded on Purpose

- GSD/OMX workflows.
- New sprint-based planning surfaces.
- Extra GitHub label taxonomies that duplicate Project fields.
- Windows 지원. macOS/Linux만 보장한다. `chmod`, shebang, POSIX 권한·시그널 모델 등의 POSIX 의존 패턴은 그대로 사용하며, Windows 호환성 제안(예: cross-platform shim, polyfill, `mode` 옵션 제거, shebang 우회)은 won't fix로 처리한다.
<!-- END ACO GENERATED CONTEXT -->
