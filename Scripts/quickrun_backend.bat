@echo off
setlocal

:: Get the absolute path of the project directory (one level up from the script location)
pushd "%~dp0.."
set "PROJECT_DIR=%CD%"
popd

cd /d "%PROJECT_DIR%"

:: Check if Python is installed
where /q python
if errorlevel 1 (
    echo Python not found. Please install Python to continue.
    pause
    exit /b 1
)

:: Set the virtual environment directory
set "VENV_DIR=%PROJECT_DIR%\venv"

:: Check if the virtual environment directory exists
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Virtual environment not found. Running install.bat to create it...
    call "%PROJECT_DIR%\scripts\run_frontend.bat"
    pause
)

:: Activate the virtual environment
call "%VENV_DIR%\Scripts\activate.bat"

cls
:: Run the main Python script
python "%PROJECT_DIR%\backend\app.py"

:: Deactivate the virtual environment
deactivate
pause
endlocal
