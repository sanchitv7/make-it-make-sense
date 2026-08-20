#!/usr/bin/env bash
# beforeShellExecution: require HEAD up to date with origin/main before `gh pr create`.
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

# Detect real `gh pr create` via argv tokens (not substrings inside quotes/heredocs).
is_gh_pr_create="$(
  printf '%s' "$input" | python3 -c '
import json, re, shlex, sys

try:
    command = json.load(sys.stdin).get("command") or ""
except Exception:
    print("0")
    raise SystemExit(0)

GH_GLOBAL_VALUE_FLAGS = {"-R", "--repo", "--hostname"}

def positionals_after_gh(tokens):
    i = 1
    while i < len(tokens):
        t = tokens[i]
        if t == "--":
            return tokens[i + 1 :]
        if t.startswith("-"):
            if "=" in t:
                i += 1
                continue
            if t in GH_GLOBAL_VALUE_FLAGS:
                i += 2
                continue
            i += 1
            continue
        break
    return tokens[i:]

def is_create(command: str) -> bool:
    if not command or "pr" not in command or not re.search(r"\bgh\b", command):
        return False
    for seg in re.split(r"(?:&&|\|\||\n|;)", command):
        seg = seg.strip()
        if not seg or seg.startswith("#"):
            continue
        while True:
            m = re.match(r"^[A-Za-z_][A-Za-z0-9_]*=\S*\s+", seg)
            if not m:
                break
            seg = seg[m.end() :]
        try:
            tokens = shlex.split(seg, posix=True)
        except ValueError:
            continue
        while tokens and tokens[0] in {"command", "time", "nice", "nohup", "env"}:
            tokens = tokens[1:]
        if not tokens:
            continue
        if tokens[0].rsplit("/", 1)[-1] != "gh":
            continue
        pos = positionals_after_gh(tokens)
        if not pos or pos[0] != "pr":
            continue
        j = 1
        while j < len(pos) and pos[j].startswith("-"):
            if "=" in pos[j]:
                j += 1
                continue
            j += 2 if j + 1 < len(pos) and not pos[j + 1].startswith("-") else 1
        if j < len(pos) and pos[j] == "create":
            return True
    return False

print("1" if is_create(command) else "0")
'
)"

if [[ "$is_gh_pr_create" != "1" ]]; then
  allow
fi

fetch_err="$(mktemp)"
if ! git fetch origin main >/dev/null 2>"$fetch_err"; then
  err="$(tr '\n' ' ' <"$fetch_err" | sed 's/[[:space:]]\+/ /g')"
  rm -f "$fetch_err"
  deny \
    "Blocked gh pr create: could not fetch origin/main. Fix network/auth and retry." \
    "git fetch origin main failed (${err:-unknown error}). Fetch is required before creating a PR."
fi
rm -f "$fetch_err"

if ! git rev-parse --verify --quiet origin/main >/dev/null; then
  deny \
    "Blocked gh pr create: origin/main missing after fetch." \
    "origin/main is not available. Ensure the remote default branch is main, then: git fetch origin main"
fi

if ! git merge-base --is-ancestor origin/main HEAD; then
  deny \
    "Blocked gh pr create: branch is behind origin/main. Merge or rebase main first." \
    "HEAD does not contain origin/main. Run: git fetch origin main && git merge origin/main (or git rebase origin/main), resolve conflicts, then retry gh pr create. Local agent gate only — GitHub does not require up-to-date-at-merge."
fi

mt_err="$(mktemp)"
if ! git merge-tree --write-tree origin/main HEAD >/dev/null 2>"$mt_err"; then
  conflicts="$(grep -E 'CONFLICT|conflict' "$mt_err" | head -20 | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')"
  if [[ -z "$conflicts" ]]; then
    conflicts="$(tr '\n' ' ' <"$mt_err" | sed 's/[[:space:]]\+/ /g' | cut -c1-400)"
  fi
  rm -f "$mt_err"
  deny \
    "Blocked gh pr create: merging into origin/main would conflict." \
    "Resolve conflicts with origin/main first (merge or rebase), then retry. Details: ${conflicts:-merge-tree failed}"
fi
rm -f "$mt_err"

allow
