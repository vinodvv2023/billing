@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%"
set "FRONTEND_DIR=%ROOT%frontend"
set "VENV_PYTHON=%ROOT%.venv\Scripts\python.exe"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "NPM_CLI=C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"

if exist "%VENV_PYTHON%" (
  set "BACKEND_CMD="%VENV_PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
) else (
  set "BACKEND_CMD=python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
)

if exist "%NODE_EXE%" if exist "%NPM_CLI%" (
  set "FRONTEND_CMD="%NODE_EXE%" "%NPM_CLI%" run dev"
) else (
  set "FRONTEND_CMD=npm run dev"
)

echo =========================================
echo Starting BillingApp Backend and Frontend...
echo =========================================

:: Start the Python backend in a new command window
echo Starting Backend (FastAPI)...
start "BillingApp Backend" cmd /k "cd /d "%BACKEND_DIR%" && %BACKEND_CMD%"

:: Start the Next.js frontend in another new command window
echo Starting Frontend (Next.js)...
start "BillingApp Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && %FRONTEND_CMD%"

echo.
echo Both services are spinning up in separate windows!
echo Backend API Docs: http://127.0.0.1:8000/docs
echo Frontend App:     http://localhost:3000
echo.
endlocal

