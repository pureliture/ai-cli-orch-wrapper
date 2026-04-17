Run the executor delegate with marshaled repository context.

```bash
ARGS="${ARGUMENTS:-}"
DIFF="$(git diff --cached 2>/dev/null)"
[ -z "$DIFF" ] && DIFF="$(git diff HEAD 2>/dev/null || echo "")"
BRANCH="$(git branch --show-current 2>/dev/null || echo "")"
if [ "${#DIFF}" -gt 50000 ]; then
  DIFF="${DIFF:0:50000}
[truncated]"
fi
PROMPT=$(cat <<EOF
## Task
$ARGS

## Branch
$BRANCH

## Changes
\`\`\`diff
$DIFF
\`\`\`
EOF
)
aco delegate executor --input "$PROMPT"
```
