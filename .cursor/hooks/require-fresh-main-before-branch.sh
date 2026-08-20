#!/usr/bin/env bash
# beforeShellExecution: require HEAD contains origin/main before new branch/worktree.
set -euo pipefail

input="$(cat)"

allow() {
  echo '{ "permission": "allow" }'
  exit 0
}

deny() {
  python3 -c 'import json,sys; print(json.dumps({"permission":"deny","user_message":sys.argv[1],"agent_message":sys.argv[2]}))' "$1" "$2"
  exit 0
}

needs_fresh_main="$(
  printf '%s' "$input" | python3 -c '
import json, re, shlex, sys

try:
    command = json.load(sys.stdin).get("command") or ""
except Exception:
    print("0")
    raise SystemExit(0)

def segments(command: str):
    for seg in re.split(r"(?:&&|\|\||\n|;)", command):
        seg = seg.strip()
        if not seg or seg.startswith("#"):
            continue
        while True:
            m = re.match(r"^[A-Za-z_][A-Za-z0-9_]*=\S*\s+", seg)
            if not m:
                break
            seg = seg[m.end() :]
        yield seg

def tokens_of(seg: str):
    try:
        tokens = shlex.split(seg, posix=True)
    except ValueError:
        return []
    while tokens and tokens[0] in {"command", "time", "nice", "nohup", "env"}:
        tokens = tokens[1:]
    return tokens

def is_new_branch_or_worktree(command: str) -> bool:
    if not command or "git" not in command:
        return False
    for seg in segments(command):
        tokens = tokens_of(seg)
        if not tokens:
            continue
        if tokens[0].rsplit("/", 1)[-1] != "git":
            continue
        # git switch -c <branch>
        if len(tokens) >= 3 and tokens[1] == "switch" and "-c" in tokens[2:]:
            return True
        # git checkout -b <branch>
        if len(tokens) >= 3 and tokens[1] == "checkout" and "-b" in tokens[2:]:
            return True
        # git worktree add ... (new worktree / often -b)
        if len(tokens) >= 3 and tokens[1] == "worktree" and tokens[2] == "add":
            return True
    return False

print("1" if is_new_branch_or_worktree(command) else "0")
'
)"

if [[ "$needs_fresh_main" != "1" ]]; then
  allow
fi

fetch_err="$(mktemp)"
if ! git fetch origin main >/dev/null 2>"$fetch_err"; then
  err="$(tr '\n' ' ' <"$fetch_err" | sed 's/[[:space:]]\+/ /g')"
  rm -f "$fetch_err"
  deny \
    "Blocked new branch/worktree: could not fetch origin/main." \
    "git fetch origin main failed (${err:-unknown}). Run make sync-main (or fetch/pull main) then retry."
fi
rm -f "$fetch_err"

if ! git rev-parse --verify --quiet origin/main >/dev/null; then
  deny \
    "Blocked new branch/worktree: origin/main missing after fetch." \
    "Ensure remote default branch is main, then: git fetch origin main && make sync-main"
fi

if ! git merge-base --is-ancestor origin/main HEAD; then
  deny \
    "Blocked new branch/worktree: start from latest main first." \
    "HEAD does not contain origin/main. For a new task: git fetch origin main && git checkout main && git pull --ff-only origin main (or make sync-main), then create the branch/worktree from that tip."
fi

allow
