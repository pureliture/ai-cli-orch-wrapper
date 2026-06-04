---
"@pureliture/ai-cli-orch-wrapper": minor
---

Add `ACO_HOME` env var to relocate the aco data root.

aco previously hardcoded its data root to `~/.aco`, so dev/test runs (e.g.
`aco ask --task test --providers mock`) wrote run ledgers into the developer's
real `~/.aco`, mixing throwaway mock runs into actual usage history. Setting
`ACO_HOME` now redirects all aco state — runs, sessions, agy-workspace, and the
provider-auth-cache — to the given directory. When unset, behavior is unchanged
(`~/.aco`). The test suite uses this to keep `npm test` from polluting `~/.aco`.
