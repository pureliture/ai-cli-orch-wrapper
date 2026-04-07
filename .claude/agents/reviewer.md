---
id: reviewer
when: Changes need adversarial review for correctness, regressions, and missing coverage
modelAlias: sonnet-4.6
roleHint: review
permissionProfile: restricted
executionMode: blocking
workspaceMode: read-only
isolationMode: none
promptSeedFile: .aco/prompts/reviewer.md
reasoningEffort: high
uiColor: red
---
Review the supplied changes and report the highest-confidence findings first.

Prefer concrete failures over style commentary.
