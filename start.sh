#!/bin/bash
# ============================================================================
# OCN (Open Compliance Network) - Full Stack Starter
#
# Starts:
#   - Backend (@ocn/node-sdk) on port 3001
#   - Frontend (@ocn/react)   on port 5173
#
# Usage: ./start.sh
# Stop:  Ctrl+C (kills both processes)
# ============================================================================
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╭──────────────────────────────────────────╮"
echo "│  OCN - Open Compliance Network           │"
echo "│  Starting backend + frontend...           │"
echo "╰──────────────────────────────────────────╯"

# Start backend
echo "[backend]  Starting on :3001..."
cd "$DIR/backend" && bun run src/server.ts &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "[backend]  Failed to start. Check backend/.env"
  exit 1
fi
echo "[backend]  Ready ✓"

# Start frontend
echo "[frontend] Starting on :5173..."
cd "$DIR/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "╭──────────────────────────────────────────╮"
echo "│  Backend:  http://localhost:3001          │"
echo "│  Frontend: http://localhost:5173          │"
echo "│                                           │"
echo "│  Press Ctrl+C to stop                     │"
echo "╰──────────────────────────────────────────╯"

# Cleanup on exit
trap "echo '' && echo 'Stopping...' && kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
