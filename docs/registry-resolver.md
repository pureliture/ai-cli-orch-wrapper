# URL Downloader Design

This document describes the downloader-oriented architecture that is currently implemented in this repository.

## Status

The previous registry resolver design is no longer present in code. The current CLI exposes a single download workflow plus minimal lock-file management helpers.

## Current Flow

```text
wrapper download <url>
        │
        ▼
  fetch(url)
        │
        ▼
 response.text()
        │
        ▼
 resolve filename from URL path
        │
        ▼
 ensure .wrapper/downloads/ exists
        │
        ▼
 write file to disk
        │
        ▼
 read wrapper.lock
        │
        ▼
 replace existing entry for same URL
        │
        ▼
 write updated wrapper.lock
```

## Command Surface

### `wrapper download <url>`

Current command behavior:

1. logs the URL being downloaded
2. fetches the resource with the runtime `fetch`
3. converts the body to text
4. derives the local filename from `new URL(url).pathname`
5. writes the file under `.wrapper/downloads/`
6. appends or replaces the matching lock-file entry

If the HTTP response is not OK, the command exits with an error.

## Lock File Format

The current lock-file schema is intentionally small:

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

## Design Notes

- `wrapper.lock` is created lazily when the first download occurs.
- invalid or unreadable lock files currently fall back to an empty lock structure.
- duplicate downloads are deduplicated by URL, not by output path or file content.
- download metadata currently records time and destination only.

## Known Gaps

- binary-safe downloads are not implemented yet
- integrity hashes are not recorded
- there is no custom target-directory or output-filename option
- the lock file does not store upstream version or ETag metadata

## Suggested Follow-up

- add binary-safe streaming or `arrayBuffer()` support
- record a content hash in `wrapper.lock`
- support configurable output paths
- add automated tests for filename resolution and lock-file replacement behavior
