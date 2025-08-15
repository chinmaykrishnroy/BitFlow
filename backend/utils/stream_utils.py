# backend/utils/stream_utils.py
import mimetypes
from pathlib import Path
from flask import Response, request, abort

# ---------------------------
# Config
# ---------------------------
CHUNK_SIZE = 8 * 1024 * 1024  # 1 MB per chunk

# ---------------------------
# File type helpers
# ---------------------------
def get_mime_type(path: Path) -> str:
    """Return the file's MIME type, or a generic binary type if unknown."""
    mime_type, _ = mimetypes.guess_type(str(path))
    return mime_type or "application/octet-stream"

def is_playable(path: Path) -> bool:
    """
    Check if file is audio or video (playable).
    Works for any MIME type starting with 'audio/' or 'video/'.
    """
    mime = get_mime_type(path)
    return mime.startswith("audio/") or mime.startswith("video/")

def is_image(path: Path) -> bool:
    """
    Check if file is an image.
    Works for any MIME type starting with 'image/'.
    """
    mime = get_mime_type(path)
    return mime.startswith("image/")

# ---------------------------
# Streaming helpers
# ---------------------------
def file_stream_generator(file_path: Path, chunk_size: int = CHUNK_SIZE):
    """Yield file content in chunks."""
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            yield chunk

def parse_range_header(range_header: str, file_size: int):
    """Safely parse HTTP Range header, returns (start, end) or (None, None) if invalid."""
    try:
        bytes_unit, bytes_range = range_header.strip().split("=")
        if bytes_unit != "bytes":
            return None, None
        start_str, end_str = bytes_range.split("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
        if start > end or end >= file_size:
            return None, None
        return start, end
    except Exception:
        return None, None

def stream_file_response(file_path: Path):
    """
    Return a Flask Response streaming a file in chunks.
    Supports HTTP Range headers for seeking.
    """
    mime_type = get_mime_type(file_path)
    file_size = file_path.stat().st_size

    range_header = request.headers.get("Range", None)
    if range_header:
        start, end = parse_range_header(range_header, file_size)
        if start is None or end is None:
            abort(416)  # Range Not Satisfiable

        length = end - start + 1

        def partial_stream():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        resp = Response(partial_stream(), status=206, mimetype=mime_type)
        resp.headers.update({
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Disposition": f'inline; filename="{file_path.name}"'
        })
        return resp

    # Full file response
    resp = Response(file_stream_generator(file_path), mimetype=mime_type)
    resp.headers.update({
        "Content-Length": str(file_size),
        "Content-Disposition": f'inline; filename="{file_path.name}"'
    })
    return resp
