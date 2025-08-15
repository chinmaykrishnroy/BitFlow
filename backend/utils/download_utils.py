# backend/utils/download_utils.py
from pathlib import Path
from flask import Response, request, abort
import mimetypes

CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB

def get_mime_type(path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(str(path))
    return mime_type or "application/octet-stream"

def file_stream_generator(file_path: Path, chunk_size: int = CHUNK_SIZE):
    """Yield file content in chunks for download."""
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            yield chunk

def parse_range_header(range_header: str, file_size: int):
    """Parse HTTP Range header, return (start, end) or (None, None) if invalid."""
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

def download_file_response(file_path: Path):
    """
    Return a Flask Response for downloading a file.
    Supports HTTP Range headers for partial downloads.
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
            "Content-Disposition": f'attachment; filename="{file_path.name}"'
        })
        return resp

    # Full download
    resp = Response(file_stream_generator(file_path), mimetype=mime_type)
    resp.headers.update({
        "Content-Length": str(file_size),
        "Content-Disposition": f'attachment; filename="{file_path.name}"'
    })
    return resp
