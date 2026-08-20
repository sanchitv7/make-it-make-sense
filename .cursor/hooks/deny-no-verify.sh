#!/usr/bin/env bash
# beforeShellExecution: deny git commit/push with --no-verify for agents.
set -euo pipefail

input="$(cat)"

command=""
if command -v python3 >/dev/null 2>&1; then
  command="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("command") or "")' 2>/dev/null || true)"
elif command -v jq >/dev/null 2>&1; then
  command="$(printf '%s' "$input" | jq -r '.command // empty')"
fi

if [[ "$command" == *"--no-verify"* ]] && [[ "$command" =~ git[[:space:]]+(commit|push) ]]; then
  cat <<'EOF'
{
  "permission": "deny",
  "user_message": "Blocked: agents must not use git --no-verify. Fix make check / pre-commit failures instead.",
  "agent_message": "Do not bypass git hooks with --no-verify. Run make check, fix failures, then commit/push normally."
}
EOF
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
