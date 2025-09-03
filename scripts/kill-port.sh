#!/usr/bin/env bash
set -euo pipefail
PORT=${1:-3333}
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti tcp:$PORT || true)
else
  PIDS=$(fuser $PORT/tcp 2>/dev/null | tr ' ' '\n' || true)
fi
if [ -n "${PIDS:-}" ]; then
  echo "Killing processes on port $PORT: $PIDS"
  for pid in $PIDS; do
    kill -9 "$pid" || true
  done
fi
