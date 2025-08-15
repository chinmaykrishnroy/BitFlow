# backend/sockets/file_events.py
import threading
from flask_socketio import emit
from utils import file_utils

# Logical root dir name shown to user
LOGICAL_ROOT = "/"


def register_file_events(socketio):
    """
    Registers all Socket.IO events related to file browsing.
    """

    @socketio.on("list_dir")
    def handle_list_dir(data):
        """
        Event to list contents of a given logical path.
        Example client payload:
            { "path": "/movies" }
        """
        logical_path = data.get("path", LOGICAL_ROOT)

        # Immediately tell client we're working
        emit("list_dir_status", {"status": "loading", "path": logical_path})

        def worker():
            try:
                # Map logical path -> real path
                real_path = file_utils.logical_to_real_path(logical_path)

                # Get listing and metadata
                result = file_utils.list_directory_sync(logical_path)

                # Wrap in logical response structure
                response = {
                    "path": logical_path,
                    "type": result["type"],
                    "details": result["details"],
                    "children": result.get("children", [])
                }

                emit("list_dir_result", {
                    "status": "success",
                    "data": response
                })

            except FileNotFoundError:
                emit("list_dir_result", {
                    "status": "error",
                    "code": 404,
                    "message": f"Path not found: {logical_path}"
                })
            except NotADirectoryError:
                emit("list_dir_result", {
                    "status": "error",
                    "code": 400,
                    "message": f"Not a directory: {logical_path}"
                })
            except PermissionError:
                emit("list_dir_result", {
                    "status": "error",
                    "code": 403,
                    "message": f"Permission denied: {logical_path}"
                })
            except Exception as e:
                emit("list_dir_result", {
                    "status": "error",
                    "code": 500,
                    "message": str(e)
                })

        # Run in background thread to avoid blocking the socket
        threading.Thread(target=worker, daemon=True).start()
