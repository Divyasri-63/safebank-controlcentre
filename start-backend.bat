@echo off
echo ===================================================
echo Starting SafeBank Control Centre Backend (FastAPI)
echo ===================================================
cd /d "%~dp0backend"

set VENV_PY=..\..\safebank\backend\venv\Scripts\python.exe
if exist "%VENV_PY%" (
    echo Using Virtual Environment Python: %VENV_PY%
    "%VENV_PY%" -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
) else (
    echo Using System Python...
    python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
)
pause
