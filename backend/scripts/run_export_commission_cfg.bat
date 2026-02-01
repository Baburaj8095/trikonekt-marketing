@echo off
setlocal
rem Move to backend directory relative to this script's location
cd /d "%~dp0\.."

rem Ensure Django knows the settings module
set "DJANGO_SETTINGS_MODULE=core.settings"

rem Use the installed Python 3.11 explicitly to avoid Windows Store alias issues
"C:\Users\Baburaj\AppData\Local\Programs\Python\Python311\python.exe" -c "import django; django.setup(); import scripts._export_commission_cfg"

echo Export complete. Wrote ..\diag_db_monthly_759.json
endlocal
