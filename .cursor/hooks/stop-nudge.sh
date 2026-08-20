#!/usr/bin/env bash
# stop: soft nudge only — do not force a second full make check when push is next.
set -euo pipefail

input="$(cat)"
# Always emit empty follow-up; quality-gates rule covers ship via push.
# Optional nudge if status shows unpushed work without being too noisy.
echo '{}'
exit 0
