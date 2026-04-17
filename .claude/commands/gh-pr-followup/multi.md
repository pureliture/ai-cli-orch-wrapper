---
name: gh-pr-followup:multi
description: "/octo:multi variant for gh-pr-followup"
allowed-tools: [Bash]
---

Before executing `/gh-pr-followup`, validate that `/octo:multi` is available and that the current multi-agent context is ready.

1. Check whether `/octo:multi` is available in this environment.
2. If `/octo:multi` is not available, stop here and tell the user to run `/octo:setup` first, then retry this command after setup completes.
3. If `/octo:multi` is available, run `/octo:multi` to validate the current multi-agent context and PR status.
4. Only once that validation passes, proceed with the `/gh-pr-followup` instructions to fetch review threads, apply fixes or defer to new issues, and resolve threads on GitHub.