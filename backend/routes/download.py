# backend/routes/download.py
from flask import Blueprint, request
from utils import logical_to_real_path
from utils.download_utils import download_file_response

download_bp = Blueprint("download", __name__, url_prefix="/download")

@download_bp.route("/file", methods=["GET"])
def download_file():
    """
    Download any file from MEDIA_ROOT.
    Query parameter:
        - path: logical path under MEDIA_ROOT
    """
    logical_path = request.args.get("path")
    if not logical_path:
        return {"status": "error", "message": "Missing 'path' query parameter"}, 400

    try:
        real_path = logical_to_real_path(logical_path)
    except ValueError as e:
        return {"status": "error", "message": str(e)}, 400

    if not real_path.exists():
        return {"status": "error", "message": "File does not exist"}, 404
    if not real_path.is_file():
        return {"status": "error", "message": "Path is not a file"}, 400

    # Serve the file for download
    try:
        return download_file_response(real_path)
    except Exception as e:
        return {"status": "error", "message": f"Failed to download file: {e}"}, 500
