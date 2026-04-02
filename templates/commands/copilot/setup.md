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
echo "## GitHub Copilot CLI Setup"
echo ""
aco provider setup copilot || true
echo ""
echo "If not installed: npm install -g @github/copilot"
echo "Then authenticate: gh auth login"
```
