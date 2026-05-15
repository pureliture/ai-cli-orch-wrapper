# Gray Box Workflow Kickoff Index

작성일: 2026-05-12

이 문서는 `ai-cli-orch-wrapper`를 Matt Pocock의 gray box 관점에 더 가깝게 만들기 위한 세 개의 독립 workflow를 시작하는 인덱스다.
각 workflow는 서로 관련은 있지만 implementation scope가 크므로 별도 OpenSpec change로 진행한다.

## Background

현재 repo는 이미 좋은 방향을 갖고 있다.

- `aco ask`는 consent-gated provider invocation을 제공한다.
- provider output은 advisory로 취급되고 run/session artifact에 저장된다.
- `aco sync`는 source surface와 generated target surface를 분리한다.
- Node wrapper와 Go runtime boundary가 문서화되어 있다.

남은 문제는 gray box의 "box boundary"를 사람이 더 잘 이해하고 검증할 수 있게 만드는 것이다.
즉, 내부 구현을 모두 읽지 않아도 안전하게 위임할 수 있으려면 공유 언어, 구조화된 결과물, portable sync 상태가 필요하다.

## Workflow Map

| Order | Workflow                     | OpenSpec change                                       | Primary outcome                                               |
| ----- | ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| 1     | Ubiquitous language          | `openspec/changes/introduce-ubiquitous-language/`     | repo-wide domain terms and naming rules                       |
| 2     | Structured findings artifact | `openspec/changes/add-structured-findings-artifacts/` | machine-readable provider findings with human-readable briefs |
| 3     | Repo-portable sync manifest  | `openspec/changes/make-sync-manifest-portable/`       | clone-safe sync manifest paths and migration behavior         |

## Workflow 1 Implementation Handoff

- Briefing page: [introduce-ubiquitous-language-proposal.html](introduce-ubiquitous-language-proposal.html)
- Implementation plan: [introduce-ubiquitous-language-implementation-plan.md](introduce-ubiquitous-language-implementation-plan.md)

## Suggested Sequencing

1. Start with ubiquitous language because it defines how future docs and schemas should name concepts.
2. Then implement structured findings because it depends on stable terms such as `finding`, `advisory`, `session`, `run`, and `provider`.
3. Then implement repo-portable sync manifest because it touches sync engine compatibility and should reuse the language established by workflow 1.

The workflows can be implemented independently, but changing the order increases rework risk.

## Shared Constraints

- Do not merge these workflows into one giant implementation branch.
- Preserve the public `aco` CLI contract unless a change document explicitly updates it.
- Keep provider output advisory. Do not make external providers authoritative.
- Keep mock-provider paths deterministic and no-auth for CI and local smoke tests.
- Keep docs truthful about what is implemented versus planned.
- Use TDD for behavior changes.
- Run verification before completion claims.

## External Reference Checks

- Context7 lookup for OpenSpec confirmed the repository-compatible change shape: `proposal.md`, `design.md`, `tasks.md`, optional `.openspec.yaml`, and `specs/<capability>/spec.md`.
- OpenAI developer docs describe Codex as a coding agent that can write, review, debug, and work through IDE/CLI/web surfaces. This repo should still treat Codex output as advisory within `aco`, not as an authoritative replacement for maintainer review.

## Handoff Prompt

Use this prompt when starting a new session for any one workflow:

```text
/goal
Goal: Execute exactly one gray-box hardening workflow from ai-cli-orch-wrapper.

Context:
- Repo: /Users/ddalkak/Projects/ai-cli-orch-wrapper
- Start from origin/main in an isolated worktree.
- Pick one OpenSpec change only:
  - introduce-ubiquitous-language
  - add-structured-findings-artifacts
  - make-sync-manifest-portable
- Read docs/plans/gray-box-workflows/README.md first.
- Then read the selected change's proposal.md, design.md, tasks.md, and specs/*/spec.md.

Constraints:
- Do not combine workflows.
- Keep provider output advisory.
- Preserve existing CLI contracts unless the selected OpenSpec change explicitly says otherwise.
- Use failing tests before implementation.
- Separate implementation verification from runtime/provider verification.
- Do not touch unrelated local changes.

Required work:
1. Validate the selected OpenSpec change.
2. Turn the selected tasks.md into an implementation plan if needed.
3. Implement only that workflow.
4. Run focused tests, then repo-appropriate verification.
5. Update docs and tasks status truthfully.

Progress visibility:
- Report Implementation progress and Runtime/provider verification progress separately.
- Call out any verification that remains mock-only or local-only.

Done when:
- The selected workflow's tests and docs pass.
- The change can be reviewed without reading unrelated workflow state.
- Any remaining risks are documented in the selected change.
```
