@echo off
echo ========================================================
echo Starting SafeBank Control Centre (Backend + Frontend)
echo ========================================================

start "SafeBank Backend (FastAPI :8001)" cmd /k "%~dp0start-backend.bat"
timeout /t 2 /nobreak >nul
start "SafeBank Frontend (Vite :5174)" cmd /k "%~dp0start-frontend.bat"

echo.
echo Both servers are launching:
echo   - Backend API: http://localhost:8001
echo   - Swagger Docs: http://localhost:8001/docs
echo   - Frontend UI: http://localhost:5174
echo.
pause
