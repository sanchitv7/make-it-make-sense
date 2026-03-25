#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAX_RESTARTS=5
RESTART_DELAY=2

# ── helpers ──────────────────────────────────────────────────────────────────

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ── pre-flight checks ─────────────────────────────────────────────────────────

[[ -d "$ROOT_DIR/backend" ]]  || die "backend/ directory not found"
[[ -d "$ROOT_DIR/frontend" ]] || die "frontend/ directory not found"
[[ -f "$ROOT_DIR/backend/main.py" ]] || die "backend/main.py not found"
command -v uv  >/dev/null 2>&1 || die "'uv' not found in PATH"
command -v npm >/dev/null 2>&1 || die "'npm' not found in PATH"

# ── venv setup ────────────────────────────────────────────────────────────────

cd "$ROOT_DIR/backend"
if [[ ! -d .venv ]]; then
  log "Creating venv..."
  uv venv
fi
source .venv/bin/activate
log "Installing backend dependencies..."
uv pip install -r requirements.txt -q
cd "$ROOT_DIR"

# ── process tracking ─────────────────────────────────────────────────────────

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  log "Shutting down..."
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  log "Done."
}
trap cleanup EXIT INT TERM

# ── supervised restart loop ───────────────────────────────────────────────────

run_backend() {
  local restarts=0
  while (( restarts <= MAX_RESTARTS )); do
    log "Starting backend (attempt $((restarts + 1)))..."
    cd "$ROOT_DIR/backend"
    source .venv/bin/activate
    uvicorn main:app --reload --timeout-graceful-shutdown 1 &
    BACKEND_PID=$!
    cd "$ROOT_DIR"
    wait "$BACKEND_PID" 2>/dev/null
    local exit_code=$?
    # Exit code 0 means clean shutdown (e.g. Ctrl+C propagated) — don't restart
    [[ $exit_code -eq 0 ]] && return
    (( restarts++ ))
    if (( restarts > MAX_RESTARTS )); then
      log "Backend failed $MAX_RESTARTS times — giving up."
      kill "$FRONTEND_PID" 2>/dev/null || true
      exit 1
    fi
    log "Backend exited (code $exit_code). Restarting in ${RESTART_DELAY}s... ($restarts/$MAX_RESTARTS)"
    sleep "$RESTART_DELAY"
  done
}

run_frontend() {
  local restarts=0
  while (( restarts <= MAX_RESTARTS )); do
    log "Starting frontend (attempt $((restarts + 1)))..."
    cd "$ROOT_DIR/frontend"
    npm run dev &
    FRONTEND_PID=$!
    cd "$ROOT_DIR"
    wait "$FRONTEND_PID" 2>/dev/null
    local exit_code=$?
    [[ $exit_code -eq 0 ]] && return
    (( restarts++ ))
    if (( restarts > MAX_RESTARTS )); then
      log "Frontend failed $MAX_RESTARTS times — giving up."
      kill "$BACKEND_PID" 2>/dev/null || true
      exit 1
    fi
    log "Frontend exited (code $exit_code). Restarting in ${RESTART_DELAY}s... ($restarts/$MAX_RESTARTS)"
    sleep "$RESTART_DELAY"
  done
}

# ── launch ────────────────────────────────────────────────────────────────────

log "Starting services..."
run_backend  &
run_frontend &

log "Backend and frontend running. Press Ctrl+C to stop."
wait
