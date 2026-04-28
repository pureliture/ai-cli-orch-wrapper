#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/bin" "$TMP_DIR/scripts" "$TMP_DIR/docs/reference"
cp "$ROOT_DIR/scripts/setup-github-project.sh" "$TMP_DIR/scripts/setup-github-project.sh"
cp "$ROOT_DIR/scripts/setup-project-ids.sh" "$TMP_DIR/scripts/setup-project-ids.sh"
chmod +x "$TMP_DIR/scripts/setup-github-project.sh" "$TMP_DIR/scripts/setup-project-ids.sh"

cat > "$TMP_DIR/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

fixture_mode="${GH_FIXTURE_MODE:-missing-priority}"
args="$*"

emit_status_options() {
  printf '%s\n' \
    '{"name":"Backlog","id":"opt_backlog"}' \
    '{"name":"Ready","id":"opt_ready"}' \
    '{"name":"In Progress","id":"opt_in_progress"}' \
    '{"name":"In Review","id":"opt_in_review"}' \
    '{"name":"Done","id":"opt_done"}'
}

emit_priority_options() {
  if [[ "$fixture_mode" == "complete" ]]; then
    printf '%s\n' \
      '{"name":"P0","id":"opt_p0"}' \
      '{"name":"P1","id":"opt_p1"}' \
      '{"name":"P2","id":"opt_p2"}'
  else
    printf '%s\n' '{"name":"P0","id":"opt_p0"}'
  fi
}

emit_fields_json() {
  if [[ "$fixture_mode" == "complete" ]]; then
    cat <<'JSON'
{"fields":[{"name":"Status","id":"field_status","type":"SINGLE_SELECT","options":[{"name":"Backlog","id":"opt_backlog"},{"name":"Ready","id":"opt_ready"},{"name":"In Progress","id":"opt_in_progress"},{"name":"In Review","id":"opt_in_review"},{"name":"Done","id":"opt_done"}]},{"name":"Priority","id":"field_priority","type":"SINGLE_SELECT","options":[{"name":"P0","id":"opt_p0"},{"name":"P1","id":"opt_p1"},{"name":"P2","id":"opt_p2"}]}]}
JSON
  else
    cat <<'JSON'
{"fields":[{"name":"Status","id":"field_status","type":"SINGLE_SELECT","options":[{"name":"Backlog","id":"opt_backlog"},{"name":"Ready","id":"opt_ready"},{"name":"In Progress","id":"opt_in_progress"},{"name":"In Review","id":"opt_in_review"},{"name":"Done","id":"opt_done"}]},{"name":"Priority","id":"field_priority","type":"SINGLE_SELECT","options":[{"name":"P0","id":"opt_p0"}]}]}
JSON
  fi
}

if [[ "${1:-}" != "project" ]]; then
  echo "unexpected gh command: $args" >&2
  exit 2
fi

case "${2:-}" in
  list)
    echo "  #3  ai-cli-orch-wrapper PM  [PVT_test]"
    ;;
  view)
    echo "PVT_test"
    ;;
  create)
    echo '{"number":3,"id":"PVT_test"}'
    ;;
  field-create)
    if [[ "$args" == *"--name Status"* ]]; then
      echo '{"id":"field_status"}'
    elif [[ "$args" == *"--name Priority"* ]]; then
      echo '{"id":"field_priority"}'
    else
      echo '{"id":"field_other"}'
    fi
    ;;
  field-list)
    if [[ "$args" == *"--jq"* ]]; then
      if [[ "$args" == *'select(.name == "Status") | .options'* ]]; then
        emit_status_options
      elif [[ "$args" == *'select(.name == "Priority") | .options'* ]]; then
        emit_priority_options
      elif [[ "$args" == *'select(.name == "Status") | .id'* ]]; then
        echo "field_status"
      elif [[ "$args" == *'select(.name == "Priority") | .id'* ]]; then
        echo "field_priority"
      else
        emit_fields_json
      fi
    else
      emit_fields_json
    fi
    ;;
  link)
    exit 0
    ;;
  *)
    echo "unexpected gh project command: $args" >&2
    exit 2
    ;;
esac
EOF
chmod +x "$TMP_DIR/bin/gh"

assert_contains() {
  local file="$1"
  local expected="$2"
  if ! grep -Fq "$expected" "$file"; then
    echo "Expected to find '$expected' in $file" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"
  if grep -Fq "$unexpected" "$file"; then
    echo "Did not expect to find '$unexpected' in $file" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

run_project_ids() {
  local mode="$1"
  local name="$2"
  local out="$TMP_DIR/${name}.out"
  local err="$TMP_DIR/${name}.err"

  set +e
  (
    cd "$TMP_DIR"
    PATH="$TMP_DIR/bin:$PATH" GH_FIXTURE_MODE="$mode" bash scripts/setup-project-ids.sh <<<"3"
  ) >"$out" 2>"$err"
  local status=$?
  set -e

  echo "$status" >"$TMP_DIR/${name}.status"
}

run_setup_project() {
  local mode="$1"
  local name="$2"
  local out="$TMP_DIR/${name}.out"
  local err="$TMP_DIR/${name}.err"

  printf '%s\n' 'PM_P1_OPTION_ID=""' >"$TMP_DIR/docs/reference/project-board.md"

  set +e
  (
    cd "$TMP_DIR"
    PATH="$TMP_DIR/bin:$PATH" GH_FIXTURE_MODE="$mode" bash scripts/setup-github-project.sh
  ) >"$out" 2>"$err"
  local status=$?
  set -e

  echo "$status" >"$TMP_DIR/${name}.status"
}

run_project_ids "missing-priority" "ids-missing"
if [[ "$(cat "$TMP_DIR/ids-missing.status")" -eq 0 ]]; then
  echo "Expected setup-project-ids.sh to fail when Priority options are incomplete" >&2
  exit 1
fi
assert_contains "$TMP_DIR/ids-missing.err" "Priority option P1"
assert_contains "$TMP_DIR/ids-missing.err" "Priority option P2"
assert_not_contains "$TMP_DIR/ids-missing.out" "export PM_PROJECT_NUMBER"

run_project_ids "complete" "ids-complete"
if [[ "$(cat "$TMP_DIR/ids-complete.status")" -ne 0 ]]; then
  echo "Expected setup-project-ids.sh to print exports when IDs are complete" >&2
  cat "$TMP_DIR/ids-complete.err" >&2
  exit 1
fi
assert_contains "$TMP_DIR/ids-complete.out" 'export PM_P1_OPTION_ID="opt_p1"'

run_setup_project "missing-priority" "setup-missing"
if [[ "$(cat "$TMP_DIR/setup-missing.status")" -eq 0 ]]; then
  echo "Expected setup-github-project.sh to fail before setup success output" >&2
  exit 1
fi
assert_contains "$TMP_DIR/setup-missing.err" "Priority option P1"
assert_contains "$TMP_DIR/setup-missing.err" "Priority option P2"
assert_not_contains "$TMP_DIR/setup-missing.out" "Project setup complete"
assert_not_contains "$TMP_DIR/setup-missing.out" "export PM_PROJECT_NUMBER"
assert_contains "$TMP_DIR/docs/reference/project-board.md" 'PM_P1_OPTION_ID=""'

echo "project ID validation script tests passed"
