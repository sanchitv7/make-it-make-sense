#!/usr/bin/env bash
# sessionStart: remind about missing git hooks and stale main. Does not mutate .git.
set -euo pipefail

cat >/dev/null  # consume stdin JSON

messages=()

hooks_dir="$(git rev-parse --git-path hooks 2>/dev/null || true)"
hooks_ok=false
if [[ -n "$hooks_dir" && -f "$hooks_dir/pre-commit" && -f "$hooks_dir/pre-push" ]]; then
  if grep -q pre-commit "$hooks_dir/pre-commit" 2>/dev/null; then
    hooks_ok=true
  fi
fi

if [[ "$hooks_ok" != "true" ]]; then
  messages+=("Git quality hooks are not installed. Run \`make install\` (or \`make hooks\`) so pre-commit/pre-push run before push. Do not use git commit/push --no-verify.")
fi

# Best-effort freshness hint for new tasks (non-fatal if fetch fails).
if git fetch origin main >/dev/null 2>&1 && git rev-parse --verify --quiet origin/main >/dev/null; then
  if ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    messages+=("This checkout does not contain latest origin/main. For a new task: run \`make sync-main\` (or checkout main and pull), then create the worktree/branch from that tip.")
  fi
fi

if [[ ${#messages[@]} -eq 0 ]]; then
  echo '{}'
  exit 0
fi

python3 -c 'import json,sys; print(json.dumps({"additional_context": " ".join(sys.argv[1:])}))' "${messages[@]}"
