# Ubiquitous Language

작성일: 2026-05-14

This reference defines the first `aco` domain language slice for humans and AI agents. The initial scope is intentionally narrow: provider invocation and run/session artifacts.

## Purpose

`ai-cli-orch-wrapper` is a gray-box orchestration wrapper. Maintainers should not need to read every implementation detail to understand what a provider invocation did, what evidence was saved, and where review responsibility remains with the human.

The glossary keeps LLM-assisted documentation and implementation work aligned with repo-owned terms.

## Scope

In scope for this slice:

- provider invocation
- run/session artifacts
- provider advisory output
- brief and output artifact naming

Backlog placeholders:

- context sync terms such as `source surface`, `generated target`, `sync manifest`, and `managed block`
- harness boundary terms such as `harness`, `wrapper`, and `generated surface`
- consent and permission profile terms beyond the current examples
- verification terms beyond the current examples

## Provider Invocation

| Term                       | Definition                                                         | Example                                                        |
| -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `provider`                 | External AI CLI or local mock implementation invoked by `aco`.     | `mock`, `antigravity`, and `codex` are providers.              |
| `provider invocation`      | One execution of a provider command through `aco`.                 | `aco ask --provider mock --yes` creates a provider invocation. |
| `provider advisory output` | Provider output saved as review evidence, not authoritative truth. | `output.log` stores full provider advisory output.             |
| `permission profile`       | The permission posture attached to a run or session.               | The default permission profile is `restricted`.                |

## Run And Session Artifacts

| Term         | Definition                                                                         | Example                                                                                  |
| ------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `run`        | One high-level `aco ask` operation that may include one or more provider sessions. | A multi-provider `aco ask` creates one run with multiple sessions.                       |
| `session`    | One provider-specific execution record under a run or low-level provider command.  | Each provider session stores `task.json`, `prompt.md`, `output.log`, and `brief.md`.     |
| `artifact`   | File persisted by `aco` so the result can be reviewed after stdout has returned.   | `ledger.json`, `brief.md`, and `output.log` are artifacts.                               |
| `brief`      | Bounded human-readable summary for stdout or stored review.                        | Run-level and session-level `brief.md` files include IDs, status, and bounded summaries. |
| `output.log` | Full provider advisory output for a session.                                       | `aco result` reads the latest `output.log` unless a session is specified.                |

## Discouraged Synonyms

| Avoid                                                                     | Prefer                     | Why                                                                 |
| ------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| `provider truth` <!-- terminology-check allow: provider truth -->         | `provider advisory output` | Provider output is evidence for maintainer review, not final truth. |
| `raw provider truth` <!-- terminology-check allow: raw provider truth --> | `full provider output`     | Full output may be raw, but it is still advisory.                   |
| `generated source` <!-- terminology-check allow: generated source -->     | `generated target`         | Generated files are not the human-owned source surface.             |
| `brief log` <!-- terminology-check allow: brief log -->                   | `brief`                    | A brief is a bounded summary; `output.log` is the log artifact.     |

## Accepted Aliases

| Alias                  | Canonical term             | Usage                                                    |
| ---------------------- | -------------------------- | -------------------------------------------------------- |
| `full provider output` | `provider advisory output` | Use when contrasting full output with bounded summaries. |
| `bounded summary`      | `brief`                    | Use when explaining why brief output saves tokens.       |
| `session output`       | `output.log`               | Use when the file name is introduced immediately nearby. |

## Naming Rules

- Use `provider advisory output` when discussing trust and review responsibility.
- Use `full provider output` when discussing artifact completeness.
- Use `brief` for bounded summaries and `output.log` for full provider output.
- Use `run` for the high-level `aco ask` unit.
- Use `session` for provider-specific execution state.
- Keep public command names such as `aco ask`, `aco run`, and `aco sync` unchanged.

## Review Checklist

- Does the change describe provider output as advisory?
- Does the change distinguish `brief` from `output.log`?
- Does the change distinguish `run` from `session`?
- Does the change avoid broad renames that do not improve runtime behavior or artifact clarity?
- Does the terminology check pass without unnecessary allow comments?
