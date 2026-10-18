#!/usr/bin/env bash
# Stop the Compassion Coach servers started by scripts/start.sh
cd "$(dirname "$0")/.."
for port in 5173 3001; do
  pids=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null && echo "stopped :$port"
done
pkill -f "concurrently npm run dev npm run dev:backend" 2>/dev/null || true
rm -f .aurapet/server.pid
echo "Compassion Coach servers stopped."
