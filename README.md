# ai-cli-orch-wrapper

Lightweight CLI for downloading URL-based resources and recording where they were stored locally.

## Overview

The current implementation is intentionally small:

- downloads a resource from a URL with `wrapper download <url>`
- stores the response body under `.wrapper/downloads/`
- records the downloaded URL and local file path in `wrapper.lock`

This repository no longer implements the earlier registry sync/search/install flow.

## Installation

```bash
npm install
npm run build
```

## Quick Start

```bash
wrapper download https://example.com/config.json
cat wrapper.lock
```

Example output:

```text
Downloading: https://example.com/config.json...
Saved to: .wrapper/downloads/config.json
Updated wrapper.lock
```

## Commands

### `wrapper download <url>`

Fetches the URL, saves the response body to `.wrapper/downloads/<filename>`, and updates `wrapper.lock`.

Filename resolution:

- uses the basename from the URL path when present
- falls back to `downloaded-file` when the URL has no filename segment

Current behavior notes:

- the response is stored as text (`response.text()`)
- re-downloading the same URL replaces the existing lock-file entry for that URL
- the lock file tracks location and download time, not a content hash

### `wrapper help`

Shows the CLI help text.

### `wrapper version`

Shows the CLI version.

## Lock File

`wrapper.lock` tracks downloaded resources with a minimal schema:

```json
{
  "lockVersion": "1.0.0",
  "items": [
    {
      "url": "https://example.com/config.json",
      "localPath": ".wrapper/downloads/config.json",
      "downloadedAt": "2026-03-23T05:30:00.000Z"
    }
  ]
}
```

## Project Layout

```text
src/
  cli.ts                 CLI entry point
  commands/download.ts   URL download command
  registry/lockfile.ts   lock-file helpers
  registry/types.ts      lock-file types
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the CLI
node dist/cli.js download https://example.com/config.json

# Run the lightweight checks used in this repo
npm test
npm run lint
```

## Known Limitations

- binary downloads are not handled yet; the current implementation writes text responses
- lock entries do not yet include integrity hashes or upstream version metadata
- there is no custom output-path option yet

## License

MIT
