#!/bin/bash
echo "===================================================="
echo "Starting Main ECG Project (Backend + Frontend)"
echo "===================================================="

# Trap SIGINT/SIGTERM to kill both background jobs on Ctrl+C
trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Start Backend
echo "Starting FastAPI Backend on port 8000..."
(
  cd backend
  if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment in backend/venv..."
    python3 -m venv venv
  fi
  source venv/bin/activate
  pip install -r requirements.txt
  python app.py
) &

# Start Frontend
echo "Starting React Frontend on port 5173..."
(cd frontend && npm install && npm run dev) &

wait
