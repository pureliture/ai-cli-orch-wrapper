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

MISSING_DIR="$(mktemp -d)"
trap 'rm -rf "$MISSING_DIR"' EXIT
mkdir -p "$MISSING_DIR/docs/reference"

cat >"$MISSING_DIR/README.md" <<'DOC'
# Fixture
Provider advisory output is stored as an artifact.
DOC

set +e
npx tsx "$ROOT_DIR/scripts/check-terminology.ts" --root "$MISSING_DIR" >"$MISSING_DIR/miss.out" 2>"$MISSING_DIR/miss.err"
miss_status=$?
set -e

if [[ "$miss_status" -eq 0 ]]; then
  echo "Expected terminology check to fail when default scan files are missing" >&2
  exit 1
fi

assert_contains "$MISSING_DIR/miss.err" "default scan file"

echo "terminology check script tests passed"
