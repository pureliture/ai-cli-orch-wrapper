# Fixture Suite — aco Wrapper Behavioral Contract

This directory contains the behavioral contract fixture suite for the `aco` wrapper.

## Purpose

These fixtures define the current blocking-execution behavior of the Go wrapper.
They are written against `docs/contract/blocking-execution-contract.md`.

## Structure

Each fixture is a numbered directory:

```
test/fixtures/
├── README.md                     # this file
├── harness.ts                    # test harness (runs fixtures against a binary)
└── NN-fixture-name/
    ├── description.md            # what the fixture tests and why
    ├── setup.sh                  # (optional) create mock provider binary
    ├── input.txt                 # (optional) stdin content
    └── assertions.ts             # assertions against the binary's behavior
```

## Running Fixtures

```bash
# Against current Node binary (baseline — some will fail due to known gaps)
npm run test:fixtures -- --binary $(which aco)

# Against Go binary (cutover validation)
npm run test:fixtures -- --binary ./bin/aco-darwin-arm64
```

## Fixture Index

| # | Name | Behavior |
|---|------|----------|
| 01 | streaming-output | Provider stdout is streamed incrementally |
| 05 | exit-code-recording | `aco run` exits `0` on success and non-zero on provider failure |
| 06 | timeout-marking | Timeout terminates the provider and surfaces a timeout error |
| 07 | provider-not-found | Missing provider binary returns exit `1` with install hint |
| 08 | auth-failure | Auth-like provider failures are classified with recovery guidance |
