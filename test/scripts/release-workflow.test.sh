#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="$ROOT_DIR/.github/workflows/release.yml"

assert_contains() {
  local expected="$1"
  if ! grep -Fq -- "$expected" "$WORKFLOW"; then
    echo "Expected release workflow to contain: $expected" >&2
    exit 1
  fi
}

assert_contains "id: changesets"
assert_contains "steps.changesets.outputs.pullRequestNumber"
assert_contains "gh pr edit"
assert_contains "--add-label release"

echo "release workflow tests passed"
