#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ---------------- Configuration ----------------
APP_NAME="BitFlow"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # should be BitFlow root
VENV_DIR="$SCRIPT_DIR/venv"
BACKEND_REQ="$SCRIPT_DIR/backend/requirements.txt"
LOG_DIR="$SCRIPT_DIR/logs"
DESKTOP_DIR="$HOME/Desktop"
APP_DESKTOP_DIR="$HOME/.local/share/applications"

# Icon files (as you provided). These must exist relative to project root:
ICON_BACKEND="$SCRIPT_DIR/Scripts/icon_backend"
ICON_FRONTEND="$SCRIPT_DIR/Scripts/icon_frontend"

# Runner script paths
RUN_BACKEND="$SCRIPT_DIR/run_backend_server.sh"
QUICK_BACKEND="$SCRIPT_DIR/quickrun_backend.sh"
RUN_FRONTEND="$SCRIPT_DIR/run_frontend.sh"
START_BACKEND="$SCRIPT_DIR/start_backend.sh"
START_FRONTEND="$SCRIPT_DIR/start_frontend.sh"

# Desktop filenames
DESKTOP_BACKEND_NAME="${APP_NAME}-Backend.desktop"
DESKTOP_FRONTEND_NAME="${APP_NAME}-Frontend.desktop"

# ---------------- Helpers ----------------
log(){ printf "[INFO] %s\n" "$*" >&2; }
err(){ printf "[ERROR] %s\n" "$*" >&2; }
exists(){ command -v "$1" >/dev/null 2>&1; }

write_if_changed(){
  # write_if_changed <path> <<'EOF' ... EOF
  local path="$1"; shift
  local tmp; tmp="$(mktemp)"
  cat > "$tmp"
  if [ -f "$path" ]; then
    if cmp -s "$tmp" "$path"; then
      rm -f "$tmp"
      return 0
    fi
  fi
  mv "$tmp" "$path"
  chmod +x "$path"
  log "Wrote $path"
}

# ---------------- Start ----------------
log "BitFlow installer starting in: $SCRIPT_DIR"

# ---------------- Python / venv ----------------
PYTHON_BIN=""
for p in python3 python; do
  if exists "$p"; then
    PYTHON_BIN="$(command -v "$p")"
    break
  fi
done
if [ -z "$PYTHON_BIN" ]; then
  err "python3 not found. Install Python 3 and re-run."
  exit 1
fi
log "Using python: $PYTHON_BIN ($($PYTHON_BIN --version 2>&1))"

if [ -d "$VENV_DIR" ]; then
  log "Virtualenv present at $VENV_DIR (re-using)."
else
  log "Creating virtualenv at $VENV_DIR"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# Activate venv for installer-run (so pip installs inside it)
# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"
log "Activated venv (python: $(which python) -> $(python --version 2>&1))"

# Upgrade pip quietly (best-effort)
python -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || log "pip upgrade failed; continuing."

# ---------------- Backend deps ----------------
if [ -f "$BACKEND_REQ" ]; then
  log "Installing backend requirements from $BACKEND_REQ"
  pip install -r "$BACKEND_REQ" || log "pip install -r failed (continuing)."
else
  log "No backend/requirements.txt found; skipping pip installations."
fi

# ---------------- Frontend deps (optional) ----------------
FRONT_DIR=""
if [ -f "$SCRIPT_DIR/frontend/package.json" ]; then
  FRONT_DIR="$SCRIPT_DIR/frontend"
elif [ -f "$SCRIPT_DIR/package.json" ]; then
  FRONT_DIR="$SCRIPT_DIR"
fi

if [ -n "$FRONT_DIR" ]; then
  log "Detected frontend package.json at $FRONT_DIR"
  if exists npm; then
    pushd "$FRONT_DIR" >/dev/null
    npm install || log "npm install failed (continuing)."
    # build if build script exists
    if npm run | grep -q "build"; then
      npm run build || log "npm build failed (continuing)."
    fi
    popd >/dev/null
  elif exists yarn; then
    pushd "$FRONT_DIR" >/dev/null
    yarn install || log "yarn install failed (continuing)."
    if yarn run | grep -q "build"; then
      yarn build || log "yarn build failed (continuing)."
    fi
    popd >/dev/null
  else
    log "npm/yarn not found; skipping frontend dependency install."
  fi
else
  log "No frontend detected; skipping frontend setup."
fi

# ---------------- Ensure logs ----------------
mkdir -p "$LOG_DIR"

# ---------------- Write runner scripts ----------------
# run_backend_server.sh
write_if_changed "$RUN_BACKEND" <<'RBE'
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
# Activate venv if present
if [ -f "venv/bin/activate" ]; then
  # shellcheck source=/dev/null
  source "venv/bin/activate"
fi
# Preferred backend entrypoints (adjust if you have different file names)
if [ -f "backend/app.py" ]; then
  echo "[run_backend_server] Running python backend/app.py"
  exec python backend/app.py
elif [ -f "backend/server.py" ]; then
  echo "[run_backend_server] Running python backend/server.py"
  exec python backend/server.py
else
  echo "[run_backend_server] No backend entrypoint found (backend/app.py or backend/server.py). Exiting."
  exit 2
fi
RBE

# quickrun_backend.sh
write_if_changed "$QUICK_BACKEND" <<'QBE'
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p logs
LOG_FILE="$SCRIPT_DIR/logs/backend.log"
PID_FILE="$SCRIPT_DIR/logs/backend.pid"
VENV_ACT=""
if [ -f "venv/bin/activate" ]; then
  VENV_ACT="source \"$SCRIPT_DIR/venv/bin/activate\" && "
fi
if [ -f "backend/app.py" ]; then
  RUN_CMD='python backend/app.py'
elif [ -f "backend/server.py" ]; then
  RUN_CMD='python backend/server.py'
else
  echo "[quickrun_backend] No backend entry found. Exiting."
  exit 2
fi
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" >/dev/null 2>&1; then
    echo "[quickrun_backend] Backend already running with PID $PID"
    exit 0
  else
    echo "[quickrun_backend] Removing stale PID file."
    rm -f "$PID_FILE"
  fi
fi
echo "[quickrun_backend] Starting backend detached (nohup). Logs -> $LOG_FILE"
nohup bash -lc "$VENV_ACT exec $RUN_CMD" >> "$LOG_FILE" 2>&1 &
NEWPID=$!
echo $NEWPID > "$PID_FILE"
echo "[quickrun_backend] Started with PID $NEWPID"
QBE

# run_frontend.sh
write_if_changed "$RUN_FRONTEND" <<'RFE'
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
# prefer package.json in frontend/ or project root
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
  FRONT_DIR="$SCRIPT_DIR/frontend"
elif [ -f "package.json" ]; then
  FRONT_DIR="$SCRIPT_DIR"
else
  FRONT_DIR=""
fi
if [ -n "$FRONT_DIR" ] && [ -f "$FRONT_DIR/package.json" ]; then
  cd "$FRONT_DIR"
  if command -v npm >/dev/null 2>&1; then
    echo "[run_frontend] Running: npm start (in $FRONT_DIR)"
    exec npm start
  elif command -v yarn >/dev/null 2>&1; then
    echo "[run_frontend] Running: yarn start (in $FRONT_DIR)"
    exec yarn start
  else
    echo "[run_frontend] npm/yarn not found; cannot run package.json scripts."
  fi
fi
# fallback to python frontend/Basic/server.py
if [ -f "frontend/Basic/server.py" ]; then
  if [ -f "venv/bin/activate" ]; then
    # shellcheck source=/dev/null
    source "venv/bin/activate"
  fi
  echo "[run_frontend] Running python frontend/Basic/server.py"
  exec python frontend/Basic/server.py
fi
echo "[run_frontend] No frontend entrypoint found (package.json or frontend/Basic/server.py). Exiting."
exit 2
RFE

# start_backend.sh
write_if_changed "$START_BACKEND" <<'SBE'
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
if [ -f "venv/bin/activate" ]; then
  # shellcheck source=/dev/null
  source "venv/bin/activate"
fi
if [ -f "backend/app.py" ]; then
  exec python backend/app.py
elif [ -x "./run_backend_server.sh" ]; then
  exec ./run_backend_server.sh
else
  echo "No backend entrypoint found."
  exit 2
fi
SBE

# start_frontend.sh
write_if_changed "$START_FRONTEND" <<'SFE'
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
if [ -f "frontend/Basic/server.py" ]; then
  exec python frontend/Basic/server.py
elif [ -x "./run_frontend.sh" ]; then
  exec ./run_frontend.sh
else
  echo "No frontend entrypoint found."
  exit 2
fi
SFE

# ---------------- Create desktop shortcuts ----------------
mkdir -p "$DESKTOP_DIR" "$APP_DESKTOP_DIR"

# Choose a terminal emulator for the Exec line so user sees output
TERMCMD=""
if exists x-terminal-emulator; then TERMCMD='x-terminal-emulator -e'; fi
if [ -z "$TERMCMD" ] && exists gnome-terminal; then TERMCMD='gnome-terminal --'; fi
if [ -z "$TERMCMD" ] && exists xfce4-terminal; then TERMCMD='xfce4-terminal -e'; fi
if [ -z "$TERMCMD" ] && exists konsole; then TERMCMD='konsole -e'; fi
if [ -z "$TERMCMD" ] && exists xterm; then TERMCMD='xterm -e'; fi

make_desktop(){
  local runner="$1"
  local label="$2"
  local filename="$3"
  local iconpath="$4"
  local desktopfile="$DESKTOP_DIR/$filename"
  local appfile="$APP_DESKTOP_DIR/$filename"

  # Prefer absolute runner path
  local abs_runner="$runner"
  # Exec line: use terminal emulator if available so logs are visible
  local exec_line
  if [ -n "$TERMCMD" ]; then
    exec_line="$TERMCMD \"$abs_runner\""
  else
    exec_line="$abs_runner"
  fi

  cat > "$desktopfile" <<EOF
[Desktop Entry]
Type=Application
Name=$label
Exec=$exec_line
Path=$SCRIPT_DIR
Icon=$iconpath
Terminal=false
Categories=Utility;
EOF

  cp -f "$desktopfile" "$appfile"
  chmod +x "$desktopfile" "$appfile"
  log "Created shortcut: $desktopfile and $appfile"
}

# Validate icon files exist; if not warn and leave Icon blank
if [ -f "$ICON_BACKEND" ]; then
  ICON_BACKEND_ABS="$ICON_BACKEND"
else
  log "Warning: backend icon not found at $ICON_BACKEND. Shortcut will have no icon."
  ICON_BACKEND_ABS=""
fi
if [ -f "$ICON_FRONTEND" ]; then
  ICON_FRONTEND_ABS="$ICON_FRONTEND"
else
  log "Warning: frontend icon not found at $ICON_FRONTEND. Shortcut will have no icon."
  ICON_FRONTEND_ABS=""
fi

make_desktop "$START_BACKEND" "$APP_NAME Backend" "$DESKTOP_BACKEND_NAME" "$ICON_BACKEND_ABS"
make_desktop "$START_FRONTEND" "$APP_NAME Frontend" "$DESKTOP_FRONTEND_NAME" "$ICON_FRONTEND_ABS"

# ---------------- Final summary ----------------
log "Install complete."

cat <<EOF

Created runners (executable) in project root:
  $(basename "$RUN_BACKEND")
  $(basename "$QUICK_BACKEND")
  $(basename "$RUN_FRONTEND")
  $(basename "$START_BACKEND")
  $(basename "$START_FRONTEND")

Desktop shortcuts created:
  Desktop: $DESKTOP_DIR/$DESKTOP_BACKEND_NAME
           $DESKTOP_DIR/$DESKTOP_FRONTEND_NAME
  Applications: $APP_DESKTOP_DIR/$DESKTOP_BACKEND_NAME
                $APP_DESKTOP_DIR/$DESKTOP_FRONTEND_NAME

Notes / next steps:
 - Ensure your icons are present at:
     $ICON_BACKEND
     $ICON_FRONTEND
   If they are named differently, move/rename them to those paths before running this script.
 - To run backend in foreground:
     bash "$RUN_BACKEND"
 - To run backend detached (background):
     bash "$QUICK_BACKEND"    # logs -> $LOG_DIR/backend.log, pid -> $LOG_DIR/backend.pid
 - To run frontend:
     bash "$RUN_FRONTEND"
 - The created .desktop files use a terminal emulator (if available) so you can see logs. If your DE doesn't show them, adjust Exec line in the .desktop files.

If you want systemd service creation, custom ports, or to map exact Windows .bat logic to Linux 1:1, paste the .bat contents and I'll update the script accordingly.

EOF

exit 0
