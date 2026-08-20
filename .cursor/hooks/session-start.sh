#!/usr/bin/env bash
# sessionStart: remind if git hooks are not installed. Does not mutate .git.
set -euo pipefail

cat >/dev/null  # consume stdin JSON

hooks_dir="$(git rev-parse --git-path hooks 2>/dev/null || true)"

if [[ -n "$hooks_dir" && -f "$hooks_dir/pre-commit" && -f "$hooks_dir/pre-push" ]]; then
  # Confirm pre-commit framework installed (not just sample hooks)
  if grep -q pre-commit "$hooks_dir/pre-commit" 2>/dev/null; then
    echo '{}'
    exit 0
  fi
fi

cat <<'EOF'
{
  "additional_context": "Git quality hooks are not installed in this clone. Run `make install` (or `make hooks`) so pre-commit and pre-push run make check before push. Do not use git commit/push --no-verify."
}
EOF
