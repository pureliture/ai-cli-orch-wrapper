---
"@pureliture/ai-cli-orch-wrapper": patch
---

Harden SessionOrchestrator failure handling and store injection.

Post-create lifecycle steps (auth lookup, dashboard emit, store update, provider
run, error-log writes) are now wrapped so any rejection drives the session to a
terminal `failed` state with an error log instead of stranding it as `running`;
error-log write failures no longer mask the real run error or skip the
failed-state transition. The orchestrator threads its injected session store
into the provider runner so `envPolicy`/`pid` land in the right store, and
`aco run` validates the provider before draining stdin so an unknown provider on
a non-terminating pipe (e.g. `yes | aco run typo review`) fails fast instead of
hanging.
