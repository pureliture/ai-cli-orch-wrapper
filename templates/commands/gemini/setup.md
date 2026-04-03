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
echo "## Gemini CLI Setup"
echo ""
aco-install provider setup gemini || true
echo ""
echo "If not installed: npm install -g @google/gemini-cli"
echo "Then authenticate: gemini auth login"
```
