---
name: copilot:setup
description: Install and configure GitHub Copilot CLI provider
allowed-tools:
  - Bash
---

Install the aco pack and configure the GitHub Copilot CLI provider.

```bash
#!/usr/bin/env bash
set -euo pipefail
aco-install provider setup copilot
```
