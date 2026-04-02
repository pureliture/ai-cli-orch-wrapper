---
name: gemini:setup
description: Print Gemini CLI install instructions and required auth steps
allowed-tools:
  - Bash
---

Print installation and authentication instructions for Gemini CLI.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# D-05: Source shared adapter library (used to check current install state)
source "${SCRIPT_DIR}/../../aco/lib/adapter.sh"

echo "## Gemini CLI Setup"
echo ""
echo "### Install"
echo "  npm install -g @google/gemini-cli"
echo ""
echo "### Authenticate"
echo "  gemini auth login"
echo "  # Or: run \`gemini\` interactively and follow the OAuth browser prompts"
echo ""
echo "### Verify"
echo "  gemini --version"
echo ""

# Show current state
if aco_adapter_available "gemini"; then
  VERSION=$(aco_adapter_version "gemini")
  echo "Current status: ✓ gemini is installed ($VERSION)"
else
  echo "Current status: ✗ gemini is not installed"
fi
```
