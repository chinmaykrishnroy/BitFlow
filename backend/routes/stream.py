# backend/routes/stream.py
from flask import Blueprint, request, abort
from pathlib import Path
from utils import logical_to_real_path, is_playable, is_image, stream_file_response

stream_bp = Blueprint("stream", __name__, url_prefix="/stream")


@stream_bp.route("/file", methods=["GET"])
def stream_file():
    """
    Stream a media or image file to client.
    Query parameters:
        - path: logical path under MEDIA_ROOT (required)
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

    # Check if playable or image
    if not (is_playable(real_path) or is_image(real_path)):
        return {"status": "error", "message": "Unsupported media type"}, 415

    # Stream the file using chunked response with Range support
    try:
        return stream_file_response(real_path)
    except Exception as e:
        return {"status": "error", "message": f"Failed to stream file: {e}"}, 500
