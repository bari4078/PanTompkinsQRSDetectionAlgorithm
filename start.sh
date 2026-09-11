#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
    echo ""
    echo "Stopping servers..."

    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    wait "$BACKEND_PID" 2>/dev/null || true

    echo "Servers stopped."
}

trap cleanup INT TERM EXIT

# Start backend
echo "Starting backend..."
cd "$ROOT_DIR/backend"

/Users/shuvo/.venvs/master/bin/uvicorn app:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
cd "$ROOT_DIR/frontend"

npm run dev
