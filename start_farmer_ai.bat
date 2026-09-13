@echo off
setlocal

title Farmer AI - Local Development Server
pushd "%~dp0"

echo ========================================
echo        Farmer AI Local Startup
echo ========================================
echo.
echo Project folder: %CD%

if not exist "nithin\Scripts\activate.bat" (
    echo [ERROR] Virtual environment activation script was not found:
    echo         %CD%\nithin\Scripts\activate.bat
    echo Please make sure the existing nithin environment is in this folder.
    goto :error
)

if not exist "app.py" (
    echo [ERROR] app.py was not found in:
    echo         %CD%
    goto :error
)

echo [INFO] Activating the existing nithin virtual environment...
call "nithin\Scripts\activate.bat"
if errorlevel 1 (
    echo [ERROR] Virtual environment activation failed.
    goto :error
)

set "PYTHON=%CD%\nithin\Scripts\python.exe"
if not exist "%PYTHON%" (
    echo [ERROR] Python was not found inside the nithin environment:
    echo         %PYTHON%
    goto :error
)

echo [OK] Using Python:
"%PYTHON%" -c "import sys; print('      ' + sys.executable)"

echo [INFO] Checking required imports...
"%PYTHON%" -c "import numpy; import flask; print('[OK] NumPy and Flask are available.')"
if errorlevel 1 (
    echo [ERROR] NumPy or Flask could not be imported from nithin.
    echo        No packages were installed automatically.
    goto :error
)

echo [INFO] Starting Flask on http://127.0.0.1:5000 ...
echo [INFO] This window will stay open so server errors remain visible.
echo.

rem Suppress app.py's early browser timer; the launcher opens it after readiness.
start "Farmer AI Server" /b "%PYTHON%" -c "import runpy,webbrowser; webbrowser.open=lambda *args,**kwargs: None; runpy.run_path('app.py', run_name='__main__')"

echo [INFO] Waiting for the Flask server to become ready...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; 1..30 | ForEach-Object { if (Test-NetConnection -ComputerName 127.0.0.1 -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue) { $ready = $true; break }; Start-Sleep -Milliseconds 500 }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
    echo [ERROR] Flask did not start on port 5000 within 15 seconds.
    echo        Check the server error messages above.
    goto :error
)

echo [OK] Flask is ready. Opening Farmer AI in your browser...
start "" "http://127.0.0.1:5000/"
echo.
echo Farmer AI is running. Close this window to stop the local server.
pause
popd
exit /b 0

:error
echo.
echo Startup stopped. Fix the error above and run this file again.
pause
popd
exit /b 1