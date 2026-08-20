#!/usr/bin/env bash
# Agent-readable Maximal quality gate. Fail-fast with section headers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

section() {
  echo ""
  echo "==> $1"
}

run() {
  section "$1"
  shift
  "$@"
}

BACKEND_PYTHON="${BACKEND_PYTHON:-}"
if [[ -z "$BACKEND_PYTHON" ]]; then
  if [[ -x "$ROOT/backend/.venv/bin/python" ]]; then
    BACKEND_PYTHON="$ROOT/backend/.venv/bin/python"
  else
    BACKEND_PYTHON="python3"
  fi
fi

run "backend ruff" bash -c "cd backend && \"$BACKEND_PYTHON\" -m ruff check . && \"$BACKEND_PYTHON\" -m ruff format --check ."
run "backend mypy" bash -c "cd backend && \"$BACKEND_PYTHON\" -m mypy ."
run "backend pytest" bash -c "cd backend && \"$BACKEND_PYTHON\" -m pytest tests -q"
run "backend import-smoke" bash -c "cd backend && \"$BACKEND_PYTHON\" -c 'import main; import fact_check; import source_filter; import models; import prompts; import supabase_client'"

run "frontend format" bash -c "cd frontend && npm run format:check"
run "frontend lint" bash -c "cd frontend && npm run lint"
run "frontend typecheck" bash -c "cd frontend && npm run typecheck"
run "frontend test" bash -c "cd frontend && npm run test"
run "frontend build" bash -c "cd frontend && npm run build"

echo ""
echo "==> all checks passed"
