---
name: gh-pr-followup:multi
description: "/octo:multi variant for gh-pr-followup"
allowed-tools: [Bash]
---

Run `/octo:multi` validation before executing `/gh-pr-followup`.

1. Run `/octo:multi` to validate the current multi-agent context and PR status.
2. Once validation passes, proceed with the `/gh-pr-followup` instructions to fetch review threads, apply fixes or defer to new issues, and resolve threads on GitHub.