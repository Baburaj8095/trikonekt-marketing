@echo off
setlocal
REM Run from backend directory regardless of where it's invoked
cd /d "%~dp0"

REM Prefer a known Python 3.11 path; fall back to PATH "python"
set "PYPATH=C:\Users\Baburaj\AppData\Local\Programs\Python\Python311\python.exe"
if not exist "%PYPATH%" set "PYPATH=python"

REM Create venv if missing
if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment...
  "%PYPATH%" -m venv .venv
)

echo Using venv interpreter: .venv\Scripts\python.exe
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\pip.exe" install -r requirements.txt

echo Running Django system checks...
".venv\Scripts\python.exe" manage.py check || goto :end

echo Starting Django dev server...
".venv\Scripts\python.exe" manage.py runserver

:end
endlocal
