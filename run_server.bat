@echo off
REM ----------------------------
REM Run script for Streamer project
REM ----------------------------

REM Step 1: Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Step 2: Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Step 3: Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Step 4: Install requirements
if exist "backend\requirements.txt" (
    echo Installing dependencies...
    pip install -r backend\requirements.txt
) else (
    echo requirements.txt not found!
)

REM Step 5: Run Flask app
echo Starting Flask app...
python backend\app.py

REM Pause so terminal doesn't close immediately
pause
