# Ubiquitous Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repo-owned ubiquitous language reference for the first gray-box language slice, focused on provider invocation and session artifacts, with an automated terminology drift check from the start.

**Architecture:** The glossary is the human-readable source of truth, and a small repository script enforces a narrow set of high-risk discouraged terms across an explicit documentation surface. The first slice avoids broad code renames: it aligns docs, examples, and review guidance while preserving the public `aco` CLI contract.

**Tech Stack:** Markdown docs, Node.js 18+, TypeScript via `tsx`, Bash test harness under `test/scripts/`, OpenSpec validation, Prettier.

---

## Locked Decisions

- Start narrow: fully define provider invocation and run/session artifacts first.
- Represent context sync, harness surfaces, consent/permissions, and verification as backlog placeholders in this workflow.
- Add the automated terminology check in the first implementation slice.
- Avoid strict rename campaigns. Prefer docs-only alignment, accepted aliases, and targeted naming only when ambiguity affects behavior, emitted artifacts, or tests.
- Keep provider output advisory. External provider output must never be described as authoritative truth.

## File Structure

### Create

- `docs/reference/ubiquitous-language.md`
  Human-readable glossary and naming rules. This is the source of truth for the first slice.

- `scripts/check-terminology.ts`
  Focused terminology drift checker. It scans an explicit file list for discouraged terms and reports preferred replacements.

- `test/scripts/terminology-check.test.sh`
  Bash test harness for the checker. It uses a temporary fixture repo and verifies allowed terms, discouraged terms, accepted aliases, and allowlisted legacy language.

### Modify

- `package.json`
  Add `check:terminology` and include `test/scripts/terminology-check.test.sh` in `test:scripts`.

- `README.md`
  Add a short link to `docs/reference/ubiquitous-language.md` where the `aco` workflow or provider delegation language is introduced.

- `docs/README.md`
  Add the glossary to the docs index.

- `docs/architecture.md`
  Link the glossary near the `Goal 2 Consent-Gated Delegation Layer` and artifact terminology.

- `docs/security.md`
  Link the glossary where provider output, consent, permission profile, or advisory language appears.

- `docs/reference/session-artifacts.md`
  Add a short note that `run`, `session`, `brief`, `artifact`, and `output.log` are canonical terms defined by the glossary.

- `openspec/changes/introduce-ubiquitous-language/tasks.md`
  Mark tasks complete only after the implementation and checks pass.

## Initial Terminology Policy

The first checker should scan only this explicit surface:

```ts
const DEFAULT_SCAN_FILES = [
  'README.md',
  'docs/README.md',
  'docs/architecture.md',
  'docs/security.md',
  'docs/reference/session-artifacts.md',
  'docs/reference/ubiquitous-language.md',
  'openspec/changes/introduce-ubiquitous-language/proposal.md',
  'openspec/changes/introduce-ubiquitous-language/design.md',
  'openspec/changes/introduce-ubiquitous-language/tasks.md',
  'openspec/changes/introduce-ubiquitous-language/specs/ubiquitous-language/spec.md',
];
```

Use this initial discouraged-term map:

```ts
const DEFAULT_RULES = [
  {
    id: 'provider-output-is-advisory',
    discouraged: 'provider truth',
    preferred: 'provider advisory output',
    reason: 'Provider output is evidence for review, not authoritative truth.',
  },
  {
    id: 'provider-output-is-advisory',
    discouraged: 'raw provider truth',
    preferred: 'full provider output',
    reason: 'The raw/full output can be stored, but it is still advisory.',
  },
  {
    id: 'generated-target-not-source',
    discouraged: 'generated source',
    preferred: 'generated target',
    reason: 'Source surfaces are maintained by humans; generated targets are produced by sync.',
  },
  {
    id: 'brief-is-bounded-summary',
    discouraged: 'brief log',
    preferred: 'brief',
    reason: 'Briefs are bounded summaries, while output.log stores full provider output.',
  },
];
```

Accepted aliases:

```ts
const ACCEPTED_ALIASES = [
  { alias: 'full provider output', preferred: 'provider advisory output' },
  { alias: 'bounded summary', preferred: 'brief' },
  { alias: 'session output', preferred: 'output.log' },
];
```

Allowlist behavior:

```text
<!-- terminology-check allow: raw provider truth -->
```

The checker should ignore a discouraged term when the same line contains an allow comment for that exact term. This keeps quoted examples and migration notes possible without weakening the default rule.

## Task 1: Add the Failing Terminology Check Test

**Files:**

- Create: `test/scripts/terminology-check.test.sh`
- Modify: `package.json`

- [ ] **Step 1: Create the failing Bash test**

Add `test/scripts/terminology-check.test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/docs/reference" "$TMP_DIR/openspec/changes/introduce-ubiquitous-language/specs/ubiquitous-language"

write_required_files() {
  cat >"$TMP_DIR/README.md" <<'DOC'
# Fixture

Provider advisory output is stored as an artifact.
DOC

  cat >"$TMP_DIR/docs/README.md" <<'DOC'
# Docs

See the ubiquitous language reference.
DOC

  cat >"$TMP_DIR/docs/architecture.md" <<'DOC'
# Architecture

Full provider output remains advisory.
DOC

  cat >"$TMP_DIR/docs/security.md" <<'DOC'
# Security

Provider output is not authoritative.
DOC

  cat >"$TMP_DIR/docs/reference/session-artifacts.md" <<'DOC'
# Session Artifacts

A run contains provider sessions and each session stores output.log.
DOC

  cat >"$TMP_DIR/docs/reference/ubiquitous-language.md" <<'DOC'
# Ubiquitous Language

Preferred term: provider advisory output.
Accepted alias: full provider output.
Discouraged term example: raw provider truth. <!-- terminology-check allow: raw provider truth -->
DOC

  cat >"$TMP_DIR/openspec/changes/introduce-ubiquitous-language/proposal.md" <<'DOC'
# Proposal

Generated target is the preferred term.
DOC

  cat >"$TMP_DIR/openspec/changes/introduce-ubiquitous-language/design.md" <<'DOC'
# Design

Brief is the preferred bounded summary.
DOC

  cat >"$TMP_DIR/openspec/changes/introduce-ubiquitous-language/tasks.md" <<'DOC'
# Tasks

Run terminology checks.
DOC

  cat >"$TMP_DIR/openspec/changes/introduce-ubiquitous-language/specs/ubiquitous-language/spec.md" <<'DOC'
# Spec

Provider invocation terms are defined.
DOC
}

assert_contains() {
  local file="$1"
  local expected="$2"
  if ! grep -Fq "$expected" "$file"; then
    echo "Expected to find '$expected' in $file" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

write_required_files

npx tsx "$ROOT_DIR/scripts/check-terminology.ts" --root "$TMP_DIR" >"$TMP_DIR/pass.out"
assert_contains "$TMP_DIR/pass.out" "terminology check passed"

printf '\nThis incorrectly calls generated target generated source.\n' >>"$TMP_DIR/docs/architecture.md"

set +e
npx tsx "$ROOT_DIR/scripts/check-terminology.ts" --root "$TMP_DIR" >"$TMP_DIR/fail.out" 2>"$TMP_DIR/fail.err"
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  echo "Expected terminology check to fail for discouraged terms" >&2
  exit 1
fi

assert_contains "$TMP_DIR/fail.err" "generated source"
assert_contains "$TMP_DIR/fail.err" "generated target"
assert_contains "$TMP_DIR/fail.err" "docs/architecture.md"

echo "terminology check script tests passed"
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x test/scripts/terminology-check.test.sh
```

- [ ] **Step 3: Wire the test into root scripts**

Modify `package.json`:

```json
{
  "scripts": {
    "test:scripts": "bash test/scripts/project-id-validation.test.sh && bash test/scripts/terminology-check.test.sh",
    "check:terminology": "tsx scripts/check-terminology.ts"
  }
}
```

Keep all existing scripts and only add the new command plus the extra shell test in `test:scripts`.

- [ ] **Step 4: Run the failing test**

Run:

```bash
npm run test:scripts
```

Expected result:

```text
Error: Cannot find module .../scripts/check-terminology.ts
```

- [ ] **Step 5: Commit the failing test**

Run:

```bash
git add package.json test/scripts/terminology-check.test.sh
git commit -m "test: add terminology check coverage" -m "Co-Authored-By: Codex GPT-5 <noreply@openai.com>"
```

## Task 2: Implement the Focused Terminology Checker

**Files:**

- Create: `scripts/check-terminology.ts`
- Test: `test/scripts/terminology-check.test.sh`

- [ ] **Step 1: Add the checker implementation**

Create `scripts/check-terminology.ts`:

```ts
#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Rule = {
  id: string;
  discouraged: string;
  preferred: string;
  reason: string;
};

const DEFAULT_SCAN_FILES = [
  'README.md',
  'docs/README.md',
  'docs/architecture.md',
  'docs/security.md',
  'docs/reference/session-artifacts.md',
  'docs/reference/ubiquitous-language.md',
  'openspec/changes/introduce-ubiquitous-language/proposal.md',
  'openspec/changes/introduce-ubiquitous-language/design.md',
  'openspec/changes/introduce-ubiquitous-language/tasks.md',
  'openspec/changes/introduce-ubiquitous-language/specs/ubiquitous-language/spec.md',
] as const;

const DEFAULT_RULES: Rule[] = [
  {
    id: 'provider-output-is-advisory',
    discouraged: 'provider truth',
    preferred: 'provider advisory output',
    reason: 'Provider output is evidence for review, not authoritative truth.',
  },
  {
    id: 'provider-output-is-advisory',
    discouraged: 'raw provider truth',
    preferred: 'full provider output',
    reason: 'The raw/full output can be stored, but it is still advisory.',
  },
  {
    id: 'generated-target-not-source',
    discouraged: 'generated source',
    preferred: 'generated target',
    reason: 'Source surfaces are maintained by humans; generated targets are produced by sync.',
  },
  {
    id: 'brief-is-bounded-summary',
    discouraged: 'brief log',
    preferred: 'brief',
    reason: 'Briefs are bounded summaries, while output.log stores full provider output.',
  },
];

function parseArgs(argv: string[]): { root: string; files: string[] } {
  let root = process.cwd();
  const files: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--root requires a path');
      }
      root = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === '--file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--file requires a repo-relative path');
      }
      files.push(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    root,
    files: files.length > 0 ? files : [...DEFAULT_SCAN_FILES],
  };
}

function includesDiscouragedTerm(line: string, term: string): boolean {
  return line.toLocaleLowerCase().includes(term.toLocaleLowerCase());
}

function hasAllowComment(line: string, term: string): boolean {
  return line.includes(`terminology-check allow: ${term}`);
}

function main(): void {
  const { root, files } = parseArgs(process.argv.slice(2));
  const violations: string[] = [];

  for (const file of files) {
    const absolutePath = path.join(root, file);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/);

    lines.forEach((line, lineIndex) => {
      for (const rule of DEFAULT_RULES) {
        if (!includesDiscouragedTerm(line, rule.discouraged)) {
          continue;
        }

        if (hasAllowComment(line, rule.discouraged)) {
          continue;
        }

        violations.push(
          [
            `${file}:${lineIndex + 1}`,
            `discouraged term: "${rule.discouraged}"`,
            `preferred term: "${rule.preferred}"`,
            `rule: ${rule.id}`,
            `reason: ${rule.reason}`,
          ].join('\n  ')
        );
      }
    });
  }

  if (violations.length > 0) {
    console.error(`terminology check failed with ${violations.length} violation(s):`);
    console.error(violations.join('\n\n'));
    process.exitCode = 1;
    return;
  }

  console.log(`terminology check passed (${files.length} files scanned)`);
}

main();
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
bash test/scripts/terminology-check.test.sh
```

Expected result:

```text
terminology check script tests passed
```

- [ ] **Step 3: Run all script tests**

Run:

```bash
npm run test:scripts
```

Expected result includes:

```text
project ID validation script tests passed
terminology check script tests passed
```

- [ ] **Step 4: Run the checker on the current repo**

Run:

```bash
npm run check:terminology
```

Expected result:

```text
terminology check passed
```

If it fails on existing prose, fix the prose when the replacement is clearly correct. Use a same-line allow comment only for quoted discouraged examples inside the glossary.

- [ ] **Step 5: Commit the checker**

Run:

```bash
git add scripts/check-terminology.ts test/scripts/terminology-check.test.sh package.json
git commit -m "feat: add terminology drift check" -m "Co-Authored-By: Codex GPT-5 <noreply@openai.com>"
```

## Task 3: Add the Ubiquitous Language Reference

**Files:**

- Create: `docs/reference/ubiquitous-language.md`
- Test: `scripts/check-terminology.ts`

- [ ] **Step 1: Create the glossary**

Create `docs/reference/ubiquitous-language.md`:

```markdown
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
- advisory provider output
- brief and output artifact naming

Backlog placeholders:

- context sync terms such as `source surface`, `generated target`, `sync manifest`, and `managed block`
- harness boundary terms such as `harness`, `wrapper`, and `generated surface`
- consent and permission profile terms beyond the current examples
- verification terms beyond the current examples

## Provider Invocation

| Term                       | Definition                                                         | Example                                                        |
| -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `provider`                 | External AI CLI or local mock implementation invoked by `aco`.     | `mock`, `gemini`, and `codex` are providers.                   |
| `provider invocation`      | One execution of a provider command through `aco`.                 | `aco ask --provider mock --yes` creates a provider invocation. |
| `provider advisory output` | Provider output saved as review evidence, not authoritative truth. | `output.log` stores full provider advisory output.             |
| `permission profile`       | The permission posture attached to a run or session.               | The default permission profile is `restricted`.                |

## Run And Session Artifacts

| Term         | Definition                                                                         | Example                                                                              |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `run`        | One high-level `aco ask` operation that may include one or more provider sessions. | A multi-provider `aco ask` creates one run with multiple sessions.                   |
| `session`    | One provider-specific execution record under a run or low-level provider command.  | Each provider session stores `task.json`, `prompt.md`, `output.log`, and `brief.md`. |
| `artifact`   | File persisted by `aco` so the result can be reviewed after stdout has returned.   | `ledger.json`, `brief.md`, and `output.log` are artifacts.                           |
| `brief`      | Bounded human-readable summary for stdout or stored review.                        | `brief.md` includes run ID, session ID, status, and bounded summary.                 |
| `output.log` | Full provider advisory output for a session.                                       | `aco result` reads the latest `output.log` unless a session is specified.            |

## Discouraged Synonyms

| Avoid                | Prefer                     | Why                                                                 |
| -------------------- | -------------------------- | ------------------------------------------------------------------- |
| `provider truth`     | `provider advisory output` | Provider output is evidence for maintainer review, not final truth. |
| `raw provider truth` | `full provider output`     | Full output may be raw, but it is still advisory.                   |
| `generated source`   | `generated target`         | Generated files are not the human-owned source surface.             |
| `brief log`          | `brief`                    | A brief is a bounded summary; `output.log` is the log artifact.     |

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
```

- [ ] **Step 2: Run the checker**

Run:

```bash
npm run check:terminology
```

Expected result:

```text
terminology check passed
```

- [ ] **Step 3: Commit the glossary**

Run:

```bash
git add docs/reference/ubiquitous-language.md
git commit -m "docs: add ubiquitous language reference" -m "Co-Authored-By: Codex GPT-5 <noreply@openai.com>"
```

## Task 4: Link the Glossary from Reader-Facing Docs

**Files:**

- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/security.md`
- Modify: `docs/reference/session-artifacts.md`

- [ ] **Step 1: Add a README pointer**

Add a short sentence near the first explanation of `aco ask` or provider delegation:

```markdown
Terminology note: provider invocation, run/session artifacts, briefs, and advisory output are defined in [Ubiquitous Language](docs/reference/ubiquitous-language.md).
```

- [ ] **Step 2: Add a docs index pointer**

Add `docs/reference/ubiquitous-language.md` to the reference section in `docs/README.md`:

```markdown
- [Ubiquitous Language](reference/ubiquitous-language.md): canonical terms for provider invocation and run/session artifacts.
```

- [ ] **Step 3: Add an architecture pointer**

Add this after the existing artifact/security references in `docs/architecture.md`:

```markdown
Language reference: [Ubiquitous Language](reference/ubiquitous-language.md).
```

- [ ] **Step 4: Add a security pointer**

Add this near the advisory provider output or permission profile discussion in `docs/security.md`:

```markdown
For canonical language around provider advisory output, permission profiles, runs, sessions, and briefs, see [Ubiquitous Language](reference/ubiquitous-language.md).
```

- [ ] **Step 5: Add a session artifact pointer**

Add this near the top of `docs/reference/session-artifacts.md`:

```markdown
Terminology reference: [Ubiquitous Language](ubiquitous-language.md) defines `run`, `session`, `artifact`, `brief`, and `output.log`.
```

- [ ] **Step 6: Run documentation checks**

Run:

```bash
npm run check:terminology
npx prettier --check README.md docs/README.md docs/architecture.md docs/security.md docs/reference/session-artifacts.md docs/reference/ubiquitous-language.md
```

Expected result:

```text
terminology check passed
All matched files use Prettier code style!
```

- [ ] **Step 7: Commit the doc links**

Run:

```bash
git add README.md docs/README.md docs/architecture.md docs/security.md docs/reference/session-artifacts.md
git commit -m "docs: link ubiquitous language reference" -m "Co-Authored-By: Codex GPT-5 <noreply@openai.com>"
```

## Task 5: Update OpenSpec Task State and Verification Evidence

**Files:**

- Modify: `openspec/changes/introduce-ubiquitous-language/tasks.md`

- [ ] **Step 1: Mark completed tasks**

After Tasks 1-4 pass, update checkboxes in `openspec/changes/introduce-ubiquitous-language/tasks.md` for:

```markdown
- [x] 1.1 Create `docs/reference/ubiquitous-language.md` with core terms, discouraged synonyms, naming rules, and examples.
- [x] 1.2 Scope the first slice to provider execution and run/session artifacts.
- [x] 1.3 Add backlog placeholders for context sync, harness surfaces, consent/permissions, and verification without trying to fully define them in this workflow.
- [x] 1.4 Add a review checklist for future OpenSpec changes and PRs.
- [x] 2.1 Link the vocabulary from `README.md`, `docs/README.md`, and `docs/architecture.md`.
- [x] 2.2 Update `docs/security.md` and `docs/reference/session-artifacts.md` only where terminology clarification improves safety.
- [x] 2.3 Keep doc edits scoped; avoid broad prose rewrites unrelated to vocabulary.
- [x] 3.1 Add a small focused automated terminology check for high-risk discouraged synonyms in the initial documentation surface.
- [x] 3.2 Include tests or fixtures that cover allowed terms, discouraged terms, accepted aliases, and allowlisted legacy language.
- [x] 3.3 Document how to update the check without turning it into broad prose policing.
- [x] 4.1 Avoid a strict code rename campaign.
- [x] 4.2 Only adjust implementation names when ambiguity affects behavior, emitted artifacts, or tests.
- [x] 4.3 Prefer aliases or docs-only alignment when a legacy name is stable and not misleading at runtime.
```

Leave verification tasks unchecked until the final commands below have passed.

- [ ] **Step 2: Run final verification**

Run:

```bash
openspec validate introduce-ubiquitous-language --type change --strict
npm run test:scripts
npm run check:terminology
npx prettier --check README.md docs/README.md docs/architecture.md docs/security.md docs/reference/session-artifacts.md docs/reference/ubiquitous-language.md openspec/changes/introduce-ubiquitous-language/proposal.md openspec/changes/introduce-ubiquitous-language/design.md openspec/changes/introduce-ubiquitous-language/tasks.md openspec/changes/introduce-ubiquitous-language/specs/ubiquitous-language/spec.md
```

Expected result:

```text
Change 'introduce-ubiquitous-language' is valid
project ID validation script tests passed
terminology check script tests passed
terminology check passed
All matched files use Prettier code style!
```

- [ ] **Step 3: Mark verification tasks**

After all final verification commands pass, mark:

```markdown
- [x] 5.1 Run `openspec validate introduce-ubiquitous-language --type change --strict`.
- [x] 5.2 Run formatter/checks for touched Markdown files.
- [x] 5.3 Run the terminology guard and its focused tests.
```

For `5.4`, use a fresh agent or separate reader pass. If no fresh reader was used, leave it unchecked and add a short note below the task:

```markdown
Reader-test note: pending fresh-agent review.
```

- [ ] **Step 4: Commit OpenSpec status**

Run:

```bash
git add openspec/changes/introduce-ubiquitous-language/tasks.md
git commit -m "docs: record ubiquitous language verification" -m "Co-Authored-By: Codex GPT-5 <noreply@openai.com>"
```

## Task 6: Final Review Gate

**Files:**

- Review: all files changed by Tasks 1-5

- [ ] **Step 1: Inspect changed files**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --check
```

Expected result:

```text
git diff --check
```

prints no output.

- [ ] **Step 2: Confirm no unintended workflow bleed**

Run:

```bash
git diff --name-only origin/main...HEAD
```

Expected changed files are limited to:

```text
README.md
docs/README.md
docs/architecture.md
docs/security.md
docs/reference/session-artifacts.md
docs/reference/ubiquitous-language.md
package.json
scripts/check-terminology.ts
test/scripts/terminology-check.test.sh
openspec/changes/introduce-ubiquitous-language/tasks.md
```

The implementation should not modify structured findings artifacts or repo-portable sync manifest workflow files.

- [ ] **Step 3: Commit any final doc-only adjustments**

If final review finds small doc wording fixes, commit them separately:

```bash
git add <changed-files>
git commit -m "docs: refine ubiquitous language rollout notes" -m "Co-Authored-By: Codex GPT-5 <noreply@openai.com>"
```

## Self-Review Checklist

- Spec coverage:
  - Initial glossary scope is provider invocation and run/session artifacts.
  - Context sync and harness language is represented as backlog placeholders, not fully implemented.
  - Automated terminology check exists from the first slice.
  - Public `aco` CLI contract is preserved.
  - Code rename policy is soft and targeted.
- Placeholder scan:
  - The implementation should contain no unresolved placeholder text in docs or tests.
  - Allow comments must appear only for quoted discouraged examples.
- Verification:
  - `openspec validate introduce-ubiquitous-language --type change --strict`
  - `npm run test:scripts`
  - `npm run check:terminology`
  - `npx prettier --check ...`

## Execution Handoff

Recommended execution mode: subagent-driven implementation, one task at a time, with review between tasks.

Use this start command in a fresh session:

```text
/goal
Goal: Execute docs/plans/gray-box-workflows/introduce-ubiquitous-language-implementation-plan.md task-by-task.

Context:
- Repo: /Users/ddalkak/Projects/ai-cli-orch-wrapper/.worktrees/gray-box-kickoff-docs
- OpenSpec change: openspec/changes/introduce-ubiquitous-language/
- Plan: docs/plans/gray-box-workflows/introduce-ubiquitous-language-implementation-plan.md

Constraints:
- Implement only the ubiquitous language workflow.
- Start with failing tests for terminology check.
- Keep the first glossary slice narrow: provider invocation and session artifacts.
- Add automated terminology checking from the first slice.
- Avoid strict rename campaigns and preserve public CLI contracts.
- Do not touch structured findings or repo-portable sync manifest workflows.

Done when:
- OpenSpec validation passes.
- Script tests pass.
- Terminology check passes.
- Formatter check passes on touched docs.
- OpenSpec tasks.md reflects only verified completion.
```
