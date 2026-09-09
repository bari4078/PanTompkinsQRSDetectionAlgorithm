@echo off
echo ====================================================
echo Starting Main ECG Project (Backend + Frontend)
echo ====================================================

:: Step 1: Start the Backend in a new window
echo Starting FastAPI Backend on port 8000...
start cmd /k "cd backend && pip install -r requirements.txt && python app.py"

:: Step 2: Start the Frontend in this window
echo Starting React Frontend on port 5173...
cd frontend
call npm install
call npm run dev
