#!/usr/bin/env bash
echo "Starting SafeBank Control Centre Backend & Frontend..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start backend
cd "$SCRIPT_DIR/backend"
if [ -f "$SCRIPT_DIR/../safebank/backend/venv/bin/python" ]; then
    "$SCRIPT_DIR/../safebank/backend/venv/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
else
    python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
fi
BACKEND_PID=$!

# Start frontend
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID, Frontend PID: $FRONTEND_PID"
echo "Open browser at: http://localhost:5174"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
