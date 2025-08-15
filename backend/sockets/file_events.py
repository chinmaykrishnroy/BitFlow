# backend/sockets/file_events.py
import os
from flask import request
from utils import file_utils

LOGICAL_ROOT = "/"

def register_file_events(socketio):
    @socketio.on("list_dir")
    def handle_list_dir(data):
        logical_path = data.get("path", LOGICAL_ROOT)
        sid = request.sid

        # Immediately notify client we're loading
        socketio.emit("list_dir_status", {"status": "loading", "path": logical_path}, to=sid)

        def background_task():
            try:
                # Run the synchronous function in background
                result = file_utils.list_directory_with_progress(
                    logical_path,
                    progress_cb=lambda evt: emit_progress(evt, sid)
                )

                # Emit final result to client
                socketio.emit("list_dir_result", {"status": "success", "data": result}, to=sid)

            except Exception as e:
                msg = str(e)
                code = 500
                if "not exist" in msg.lower():
                    code = 404
                elif "not a directory" in msg.lower():
                    code = 400
                elif "permission denied" in msg.lower():
                    code = 403
                elif "outside MEDIA_ROOT" in msg:
                    code = 400

                socketio.emit("list_dir_result", {"status": "error", "code": code, "message": msg}, to=sid)

        def emit_progress(evt, sid):
            if evt.get("event") == "progress":
                socketio.emit("list_dir_status", {
                    "status": "progress",
                    "path": evt.get("path"),
                    "scanned": evt.get("scanned"),
                    "total": evt.get("total"),
                    "percent": evt.get("percent"),
                    "batch": evt.get("batch")
                }, to=sid)
            elif evt.get("event") == "done":
                socketio.emit("list_dir_status", {"status": "done", "path": evt.get("path")}, to=sid)

        # Start background task
        socketio.start_background_task(background_task)
