# Fixture Suite — aco Wrapper Behavioral Contract

This directory contains the behavioral contract fixture suite for the `aco` wrapper.

## Purpose

These fixtures define the DESIRED behavior of the Go wrapper. They are written
against the behavioral contract in `docs/contract/runtime-contract.md`, not against
the current Node.js implementation. Where the Node.js binary fails a fixture, that
is expected — it reflects a known implementation gap.

The Go wrapper must pass all fixtures before cutover (see `docs/contract/cutover-gates.md`).

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

| # | Name | Contract Requirements | Known Node.js gap? |
|---|----- |-----------------------|--------------------|
| 01 | streaming-output | R-TEE-01, R-RUN-04 | No |
| 02 | pid-capture-timing | R-RUN-03, CPW-01 | Yes |
| 03 | cancel-sigterm-sigkill | R-CANCEL-03, CPW-06 | Yes (no SIGKILL) |
| 04 | cancel-partial-output | R-TEE-04, R-CANCEL-04 | No |
| 05 | exit-code-recording | R-EXIT-01, R-EXIT-02 | Yes |
| 06 | timeout-marking | R-RUN-09, R-EXIT-03 | Yes (no timeout) |
| 07 | provider-not-found | R-AVAIL-01, R-AVAIL-02 | Partial |
| 08 | auth-failure | R-AUTH-01, R-AUTH-02 | Partial |
| 09 | status-lifecycle | R-STATUS-02, R-STATUS-04 | Yes (missing fields) |
| 10 | result-running-session | R-RESULT-02 | Yes (no banner) |
| 11 | result-failed-session | R-RESULT-04 | Yes (no error.log) |
| 12 | latest-session-resolution | R-LATEST-01..03, R-PERSIST-05 | Yes (dir scan) |
