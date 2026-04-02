---
name: copilot:status
description: Check GitHub Copilot CLI availability and version
allowed-tools:
  - Bash
---

Check whether GitHub Copilot CLI is installed and print its version. Outputs `✓` if available, `✗` if not installed.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# D-05: Source shared adapter library
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

KEY="copilot"

if aco_adapter_available "$KEY"; then
  VERSION=$(aco_adapter_version "$KEY")
  echo "✓ $KEY  $VERSION"
else
  echo "✗ $KEY  (not installed)"
  echo "  Install: npm install -g @github/copilot"
  echo "  Prerequisite: gh auth login  (GitHub CLI must be installed)"
fi
```
