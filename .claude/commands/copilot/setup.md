---
name: copilot:setup
description: Print GitHub Copilot CLI install instructions and required auth steps
allowed-tools:
  - Bash
---

Print installation and authentication instructions for GitHub Copilot CLI.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# D-05: Source shared adapter library (used to check current install state)
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

echo "## GitHub Copilot CLI Setup"
echo ""
echo "### Prerequisites"
echo "  Install GitHub CLI first: https://cli.github.com"
echo "  brew install gh  # macOS"
echo ""
echo "### Install"
echo "  npm install -g @github/copilot"
echo ""
echo "### Authenticate"
echo "  gh auth login"
echo "  # Follow the interactive prompts to authenticate with GitHub"
echo ""
echo "### Verify"
echo "  copilot --version"
echo ""

# Show current state
if aco_adapter_available "copilot"; then
  VERSION=$(aco_adapter_version "copilot")
  echo "Current status: ✓ copilot is installed ($VERSION)"
else
  echo "Current status: ✗ copilot is not installed"
fi
```
