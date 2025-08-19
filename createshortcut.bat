@echo off
setlocal

:: Define paths
set "PROJECT_DIR=%~dp0"
set "TARGET_PATH=%PROJECT_DIR%quickrun.bat"   :: Path to the batch file you want to hide and run
set "ICON_PATH=%PROJECT_DIR%icon"             :: Path to the icon file in the current directory
set "SHORTCUT_NAME=AntiAFK"
set "SHORTCUT_PATH=%PROJECT_DIR%%SHORTCUT_NAME%.lnk"
set "VBS_PATH=%PROJECT_DIR%hideWindowsTerminal.vbs"  :: Path to the external VBS script
set "VENV_DIR=%PROJECT_DIR%venv"

:: Ensure the VBS file exists
if not exist "%VBS_PATH%" (
    echo Error: %VBS_PATH% not found. Please ensure hideWindowsTerminal.vbs exists.
    exit /b 1
)

:: Ensure the virtual environment exists
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Error: Virtual environment not found in %VENV_DIR%.
    echo Please run install.bat first to set up dependencies.
    exit /b 1
)

echo Creating icon file...
:: Activate venv and run create_icon.py
call "%VENV_DIR%\Scripts\activate.bat"
python "%PROJECT_DIR%create_icon.py"
deactivate

:: Check if the icon file exists after creation
if not exist "%ICON_PATH%" (
    echo Error: Icon file not created at %ICON_PATH%.
    exit /b 1
)

echo Creating shortcut...
:: Create the shortcut using PowerShell
powershell -command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_PATH%\" \"%TARGET_PATH%\"'; $s.IconLocation = '%ICON_PATH%'; $s.Save()"

:: Check if the shortcut was created successfully
if exist "%SHORTCUT_PATH%" (
    echo Shortcut created: %SHORTCUT_PATH%
) else (
    echo Error: Failed to create the shortcut.
)

endlocal
