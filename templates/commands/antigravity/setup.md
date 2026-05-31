---
name: gemini:setup
description: Install and configure Gemini CLI provider
allowed-tools:
  - Bash
---

Install the aco pack and configure the Gemini CLI provider.

```bash
#!/usr/bin/env bash
set -euo pipefail
aco-install provider setup gemini
```
