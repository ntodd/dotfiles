#!/usr/bin/env bash
# Resets the isolated video instance, seeds it, and records every shot.
#   npm run capture            everything, from a fresh database
#   npm run capture -- live    re-record one phase against the current state
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
port="${VIDEO_PORT:-4010}"
log="$here/../.work/server.log"

start_server() {
  (cd "$repo" && RESET="${1:-}" nohup mix run --no-start marketing/video/demo/server.exs >"$log" 2>&1 &)
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "http://localhost:$port/" && return 0
    sleep 2
  done
  echo "server didn't start; see $log" >&2
  exit 1
}

if [[ -z "${1:-}" ]]; then
  pid="$(lsof -ti tcp:$port -sTCP:LISTEN || true)"
  [[ -n "$pid" ]] && kill $pid && sleep 4
  start_server 1
  (cd "$repo" && mix run --no-start marketing/video/demo/seed.exs)
  # Let the server process the seeded videos.
  sleep 40
elif ! curl -s -o /dev/null "http://localhost:$port/"; then
  start_server
fi

"$here/camera.sh"
cd "$here/.." && node demo/record.mjs "${1:-}"
