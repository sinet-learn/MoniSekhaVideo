#!/bin/bash
# Starts backend + frontend for MoniSekha. Invoked by MoniSekha.app.
# Usage: monisekha_run.sh start | stop
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$HOME/Library/Logs/MoniSekha"
PIDFILE="$LOGDIR/pids"
mkdir -p "$LOGDIR"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

stop() {
  [ -f "$PIDFILE" ] && xargs kill < "$PIDFILE" 2>/dev/null
  rm -f "$PIDFILE"
  lsof -t -iTCP:8000 -iTCP:3005 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
}

case "$1" in
stop) stop; exit 0 ;;
start)
  stop
  cd "$ROOT" || exit 1
  [ -d .venv ] || { echo "Missing .venv - see SETUP.md" >> "$LOGDIR/error.log"; exit 1; }
  # Backend (no --reload in app mode)
  .venv/bin/python -m uvicorn backend.main:app --port 8000 >> "$LOGDIR/backend.log" 2>&1 &
  echo $! > "$PIDFILE"
  # Frontend: build once, then serve the production build
  cd frontend || exit 1
  [ -d node_modules ] || npm install >> "$LOGDIR/frontend.log" 2>&1
  if [ ! -d .next ] || [ -n "$(find app package.json -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
    npm run build >> "$LOGDIR/frontend.log" 2>&1
  fi
  npm run start >> "$LOGDIR/frontend.log" 2>&1 &
  echo $! >> "$PIDFILE"
  # Wait for UI, then open it
  for _ in $(seq 1 120); do
    curl -s -o /dev/null http://localhost:3005 && break
    sleep 1
  done
  open http://localhost:3005
  ;;
esac
