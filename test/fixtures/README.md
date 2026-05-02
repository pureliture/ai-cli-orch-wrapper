# Fixture Harness

aco wrapper의 behavioral contract를 검증하는 fixture harness.

## Prerequisites

- [Go](https://go.dev/) 1.21+ (Go 바이너리 빌드용)
- [Node.js](https://nodejs.org/) 20+ 및 npm
- `tsx` (`npx tsx` 사용 가능해야 함)

## Purpose

이 fixture suite는 `aco` CLI의 Go 바이너리와 Node.js 래퍼 간 behavioral contract를
검증한다. Go 바이너리가 모든 contract의 canonical 구현체이며, Node.js 래퍼는
Go 바이너리 완성 후 대체될 예정이다.

각 fixture는 Go 바이너리를 기본 실행 대상으로 검증하며, `knownNodeGap`이 표시된
fixture는 Node.js 래퍼에서 해당 contract가 구현되어 있지 않음을 반영한다.

## Structure

```
test/fixtures/
├── README.md                     # this file
├── harness.ts                    # test harness (runs fixtures against a binary)
└── NN-fixture-name/
    ├── assertions.ts             # assertions against the binary's behavior
```

## Usage

### 기본 실행 (Go 바이너리 — 권장)

Go 바이너리가 모든 contract skeleton을 구현하고 있으므로 기본 실행 대상이다.

```bash
# 빌드 후 실행
go build -o aco ./cmd/aco
npx tsx test/fixtures/harness.ts --binary ./aco

# 또는 package script
npm run test:fixtures
```

### 특정 바이너리로 실행

```bash
npx tsx test/fixtures/harness.ts --binary <path-to-binary>
```

### Node.js 래퍼로 실행

Node.js 래퍼는 Go 바이너리 완성 후 대체될 예정이다. `knownNodeGap: true`인 fixture는
실패할 수 있다.

```bash
npm run build --workspace=packages/wrapper
chmod +x packages/wrapper/dist/cli.js
npx tsx test/fixtures/harness.ts --binary packages/wrapper/dist/cli.js
```

## Fixture Index

| # | Name | Behavior | knownNodeGap |
|---|------|----------|--------------|
| 01 | streaming-output | Provider stdout is streamed incrementally | false |
| 05 | exit-code-recording | `aco run` exits `0` on success and non-zero on provider failure | false |
| 06 | timeout-marking | Timeout terminates the provider and surfaces a timeout error | true |
| 07 | provider-not-found | Missing provider binary returns exit `1` with install hint | true |
| 08 | auth-failure | Auth-like provider failures are classified with recovery guidance | true |

## KnownNodeGap

`knownNodeGap: true`인 fixture는 Node.js 래퍼에서 해당 contract가 구현되어 있지
않으므로 Go 바이너리에서만 검증된다.

| Fixture | Node Gap Reason |
|---------|-----------------|
| `06-timeout-marking` | Node 래퍼에 `--timeout` flag 파싱 및 SIGTERM/SIGKILL 처리 없음 |
| `07-provider-not-found` | Node 래퍼에 install hint 출력 계약 없음 |
| `08-auth-failure` | Node 래퍼에 auth failure 휴리스틱(`IsAuthFailure`) 없음 |

## Adding New Fixtures

1. `test/fixtures/NN-name/assertions.ts` 생성
2. `registerFixture({ name, knownNodeGap?, fn })` 호출
3. `test/fixtures/harness.ts`에 `await import('./NN-name/assertions')` 추가
4. Go 바이너리로 실행하여 통과 확인
