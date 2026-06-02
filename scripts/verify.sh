#!/usr/bin/env bash
#
# verify.sh — run CI gates locally so failures are caught BEFORE push.
#
# Modes:
#   bash scripts/verify.sh          # FULL  — mirrors every ci.yml job
#   bash scripts/verify.sh --fast   # FAST  — deterministic, side-effect-free gates only
#
# The pre-push hook runs --fast. The fast gates (lint, contract, typecheck,
# go build) are the deterministic CI jobs that catch the breakage classes that
# actually slip past local dev (prettier drift was the recurring one). They run
# no test suite, so they spawn no provider/test child processes and perform no
# throwaway-git-repo operations — keeping the hook fast and free of side effects.
#
# FULL additionally runs the test suites (unit, go test, fixtures, smoke). Those
# spawn processes and create throwaway git workspaces, so run them by hand
# (`npm run verify`) or let CI handle them; do not put them in a push hook.
#
# Intentionally does NOT run gofmt/go vet: CI does not gate on those, so adding
# them would block pushes on pre-existing, CI-tolerated drift.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MODE="${1:-full}"
step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1" >&2; }

# ---- FAST gates: deterministic, no test suites, no child processes ----
step "lint — prettier format:check (CI: lint)"
npm run --silent format:check

step "contract — Go/Node IProvider parity (CI: contract)"
npx tsx scripts/verify-contract.ts

step "build wrapper (CI: typecheck/test prereq)"
npm run --silent build --workspace=packages/wrapper

step "typecheck (CI: typecheck)"
npm run --silent typecheck --workspace=packages/wrapper

step "go build (CI: go-build)"
BIN="$(mktemp -t aco-verify.XXXXXX)"
trap 'rm -f "$BIN"' EXIT
go build -o "$BIN" ./cmd/aco

if [ "$MODE" = "--fast" ]; then
  printf '\n\033[1;32m✓ fast gates passed (lint/contract/typecheck/build)\033[0m\n' >&2
  exit 0
fi

# ---- FULL gates: test suites (spawn processes / create throwaway git repos) ----
step "test — scripts + wrapper unit tests (CI: test)"
npm test

step "go test (CI: go-test)"
go test ./...

step "fixtures (CI: fixtures)"
npx tsx test/fixtures/harness.ts --binary "$BIN"

step "smoke — built CLI boots (CI: smoke, light variant)"
node packages/wrapper/dist/cli.js --version >/dev/null
node packages/wrapper/dist/cli.js run --help >/dev/null

printf '\n\033[1;32m✓ all local CI gates passed\033[0m\n' >&2
