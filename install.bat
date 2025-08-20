@echo off
setlocal
REM ===================================================
REM   Streamer Project Setup and Shortcut Creator
REM ===================================================

:: --- Define project paths ---
set "PROJECT_DIR=%~dp0"

:: Backend configs
set "SERVER_TARGET_PATH=%PROJECT_DIR%scripts\quickrun_backend.bat"
set "SERVER_ICON_PATH=%PROJECT_DIR%scripts\icon_backend"
set "SERVER_SHORTCUT_NAME=run_this_to_open_server"
set "SERVER_SHORTCUT_PATH=%PROJECT_DIR%%SERVER_SHORTCUT_NAME%.lnk"

:: Frontend configs
set "FRONTEND_TARGET_PATH=%PROJECT_DIR%scripts\run_frontend.bat"
set "FRONTEND_ICON_PATH=%PROJECT_DIR%scripts\icon_frontend"
set "FRONTEND_SHORTCUT_NAME=run_this_to_open_frontend"
set "FRONTEND_SHORTCUT_PATH=%PROJECT_DIR%%FRONTEND_SHORTCUT_NAME%.lnk"

echo ===================================================
echo Step 1: Virtual Environment Setup
echo ===================================================

:: Create venv if not exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 echo [!] Failed to create virtual environment.
)

:: Activate venv
echo Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 echo [!] Failed to activate virtual environment.

:: Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip
if errorlevel 1 echo [!] Failed to upgrade pip.

:: Install dependencies
if exist "backend\requirements.txt" (
    echo Installing dependencies...
    pip install -r backend\requirements.txt
    if errorlevel 1 echo [!] Failed to install dependencies.
) else (
    echo [!] requirements.txt not found!
)

echo.
echo ===================================================
echo Step 2: Creating Shortcuts
echo ===================================================

:: --- Backend Shortcut ---
if not exist "%SERVER_ICON_PATH%" (
    echo [!] Backend icon not found at %SERVER_ICON_PATH%.
) else (
    echo Creating backend shortcut...
    powershell -command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SERVER_SHORTCUT_PATH%'); $s.TargetPath = '%SERVER_TARGET_PATH%'; $s.IconLocation = '%SERVER_ICON_PATH%'; $s.Save()"
    if exist "%SERVER_SHORTCUT_PATH%" (
        echo Backend shortcut created: %SERVER_SHORTCUT_PATH%
    ) else (
        echo [!] Failed to create backend shortcut.
    )
)

:: --- Frontend Shortcut ---
if not exist "%FRONTEND_ICON_PATH%" (
    echo [!] Frontend icon not found at %FRONTEND_ICON_PATH%.
) else (
    echo Creating frontend shortcut...
    powershell -command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%FRONTEND_SHORTCUT_PATH%'); $s.TargetPath = '%FRONTEND_TARGET_PATH%'; $s.IconLocation = '%FRONTEND_ICON_PATH%'; $s.Save()"
    if exist "%FRONTEND_SHORTCUT_PATH%" (
        echo Frontend shortcut created: %FRONTEND_SHORTCUT_PATH%
    ) else (
        echo [!] Failed to create frontend shortcut.
    )
)

echo.
echo ===================================================
echo Step 3: Next Steps
echo ===================================================
echo Use the created shortcuts to start backend and frontend.
echo Backend Shortcut: %SERVER_SHORTCUT_PATH%
echo Frontend Shortcut: %FRONTEND_SHORTCUT_PATH%
echo.

echo Script finished.
echo.
pause
endlocal
