Run the generic consent-gated external AI delegation wrapper.

```bash
ARGS="${ARGUMENTS:-}"
if [ -z "$ARGS" ]; then
  echo 'Usage: /aco "natural language task for external advisory delegation"'
  exit 1
fi

aco ask --task "$ARGS" --dry-run

cat <<'EOF'

Provider execution was not started.
Review the dry-run plan above. If you want to invoke providers, run an explicit
aco ask command with --yes, for example:

  aco ask --providers mock --task "<task>" --input "<input>" --yes

Use --output-mode full only when you explicitly want full provider output in
the Claude Code session. By default, aco ask saves full output as artifacts and
returns a bounded brief.
EOF
```

Alternatively, for directing a task to a specific named agent spec:

  aco delegate <agent-id> --input "<task and context>"

This reads the agent spec from `.claude/agents/<agent-id>.md`, combines its
seed prompt with the supplied input, and prints the result to stdout.
`aco delegate` does NOT auto-intercept Agent tool calls — it must be invoked
explicitly.
