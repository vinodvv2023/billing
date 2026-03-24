@echo off
echo =========================================
echo Starting OAuth Backend and Frontend...
echo =========================================

:: Start the Python backend in a new command window
echo Starting Backend (FastAPI)...
start "OAuth Backend" cmd /k "cd /d "%~dp0" && call .\.venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: Start the Next.js frontend in another new command window
echo Starting Frontend (Next.js)...
start "Next.js Frontend" cmd /k "cd /d "%~dp0\frontend" && npm run dev"

echo.
echo Both services are spinning up in separate windows!
echo Backend API Docs: http://127.0.0.1:8000/docs
echo Frontend App:     http://localhost:3000
echo.
pause
