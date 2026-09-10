cat << 'EOF' > run_main.sh
#!/bin/bash
echo "===================================================="
echo "Starting Main ECG Project (Backend + Frontend)"
echo "===================================================="

# Trap SIGINT/SIGTERM to kill both background jobs on Ctrl+C
trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Start Backend
echo "Starting FastAPI Backend on port 8000..."
(cd backend && pip install -r requirements.txt && python app.py) &

# Start Frontend
echo "Starting React Frontend on port 5173..."
(cd frontend && npm install && npm run dev) &

wait
EOF
chmod +x run_main.sh
