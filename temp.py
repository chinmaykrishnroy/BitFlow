#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DIY HDD Streaming Server (Python + Flask) — Single File
------------------------------------------------------
Features:
- Browse folders on your HDD in a simple web UI
- Stream video/audio with HTTP Range support (seek without full download)
- Optional HTTP Basic Auth via environment variables
- Safe path handling to prevent escaping MEDIA_ROOT
- Minimal deps: Flask

Quick start
1) Install Python 3.9+
2) Install deps:
   pip install flask
3) Set your media root (edit MEDIA_ROOT below or set env var):
   Linux/Mac: export MEDIA_ROOT="/path/to/Media"
   Windows  : set MEDIA_ROOT=D:\Media
4) Optional security:
   set AUTH_USER=admin
   set AUTH_PASS=yourStrongPass
5) Run:
   python hdd_streamer.py
6) Open:
   http://localhost:5000

Expose to internet:
- Forward TCP port 5000 on your router to this PC's local IP.
- Strongly recommended: enable AUTH_USER/AUTH_PASS or put behind a reverse proxy with HTTPS.

"""
import os
import mimetypes
import math
from pathlib import Path
from functools import wraps
from urllib.parse import quote, unquote

from flask import Flask, request, Response, abort, redirect, url_for, make_response

# ----------------- Config -----------------
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", r"D:\Media")).resolve()  # <-- change for your HDD
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "5000"))
AUTH_USER = os.environ.get("AUTH_USER", "")
AUTH_PASS = os.environ.get("AUTH_PASS", "")

if not MEDIA_ROOT.exists() or not MEDIA_ROOT.is_dir():
    raise SystemExit(f"[FATAL] MEDIA_ROOT does not exist or is not a directory: {MEDIA_ROOT}")

app = Flask(__name__)

# ----------------- Auth -----------------
def requires_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not AUTH_USER or not AUTH_PASS:
            return f(*args, **kwargs)
        auth = request.authorization
        if auth and auth.username == AUTH_USER and auth.password == AUTH_PASS:
            return f(*args, **kwargs)
        resp = Response("Authentication required", 401, {"WWW-Authenticate": 'Basic realm="media"'})
        return resp
    return wrapper

# ----------------- Helpers -----------------
def escape_html(s: str) -> str:
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
         .replace('"', "&quot;")
         .replace("'", "&#39;")
    )

def is_subpath(parent: Path, child: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except Exception:
        return False

def safe_join(base: Path, rel: str) -> Path:
    rel = rel.replace("\\", "/")
    target = (base / rel).resolve()
    if not is_subpath(base, target):
        raise ValueError("Path outside root")
    return target

def format_bytes(n: int) -> str:
    if n == 0:
        return "0 B"
    k = 1024.0
    units = ["B", "KB", "MB", "GB", "TB"]
    i = int(math.floor(math.log(n, k)))
    return f"{n / (k ** i):.2f} {units[i]}"

ICONS = {
    "folder": "📁",
    "video": "🎬",
    "audio": "🎵",
    "file": "📄",
}

VIDEO_MT = {"video/mp4","video/webm","video/ogg","video/x-matroska","video/quicktime"}
AUDIO_MT = {"audio/mpeg","audio/ogg","audio/wav","audio/aac","audio/flac","audio/mp4"}

def classify(path: Path):
    mt, _ = mimetypes.guess_type(str(path))
    if mt in VIDEO_MT:
        return "video", mt or "application/octet-stream"
    if mt in AUDIO_MT:
        return "audio", mt or "application/octet-stream"
    return "file", mt or "application/octet-stream"

def page(title: str, body: str, extra_head: str = "") -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{escape_html(title)}</title>
<style>
:root {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; }}
body {{ margin: 0; background: #0b0c10; color: #e5e7eb; }}
header {{ padding: 16px 20px; background: #111827; position: sticky; top: 0; z-index: 10; }}
h1 {{ margin: 0; font-size: 18px; font-weight: 600; }}
.container {{ padding: 16px 20px; }}
a {{ color: #93c5fd; text-decoration: none; }}
a:hover {{ text-decoration: underline; }}
.crumbs {{ font-size: 14px; margin-bottom: 12px; }}
.grid {{ display: grid; grid-template-columns: 1fr; gap: 8px; }}
@media (min-width: 640px) {{ .grid {{ grid-template-columns: 1fr 1fr; }} }}
@media (min-width: 1024px) {{ .grid {{ grid-template-columns: 1fr 1fr 1fr; }} }}
.item {{ display: flex; align-items: center; gap: 12px; background: #1f2937; border-radius: 14px; padding: 12px 14px; box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset; }}
.item:hover {{ background: #273244; }}
.badge {{ font-size: 12px; opacity: 0.7 }}
.icon {{ width: 22px; text-align: center; opacity: 0.9; }}
.spacer {{ flex: 1; }}
.muted {{ color: #9ca3af }}
.pill {{ background: #374151; padding: 2px 8px; border-radius: 999px; font-size: 12px; }}
.player {{ max-width: 1080px; margin: 16px auto; background: #111827; border-radius: 16px; padding: 12px; box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset; }}
video, audio {{ width: 100%; outline: none; border-radius: 10px; }}
.topbar {{ display: flex; align-items: center; gap: 12px; justify-content: space-between; margin-bottom: 10px; }}
input[type="text"] {{ background: #111827; color: #e5e7eb; border: 1px solid #374151; border-radius: 10px; padding: 8px 10px; width: 100%; }}
</style>
{extra_head}
</head>
<body>
<header><h1>My HDD Streamer (Python)</h1></header>
<div class="container">{body}</div>
</body>
</html>"""

# ----------------- Routes -----------------
@app.route("/")
@requires_auth
def root():
    return redirect(url_for("browse"))

@app.route("/browse")
@requires_auth
def browse():
    rel = request.args.get("path", "").strip()
    try:
        current = safe_join(MEDIA_ROOT, rel)
    except ValueError:
        abort(400, "Invalid path")

    if not current.exists() or not current.is_dir():
        abort(404, "Directory not found")

    parts = [p for p in rel.split("/") if p]
    crumbs = [f'<a href="{url_for("browse")}">/</a>']
    prefix = ""
    for p in parts:
        prefix = f"{prefix}/{p}" if prefix else p
        crumbs.append(f'<span class="muted">›</span> <a href="{url_for("browse")}?path={quote(prefix)}">{escape_html(p)}</a>')

    parent_rel = "/".join(parts[:-1]) if parts else ""

    entries = sorted(current.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    items_html = []
    for p in entries:
        name = p.name
        child_rel = f"{rel}/{name}" if rel else name
        if p.is_dir():
            link = f'{url_for("browse")}?path={quote(child_rel)}'
            icon = ICONS["folder"]
            meta = '<span class="badge">(folder)</span>'
        else:
            kind, _ = classify(p)
            link = f'{url_for("watch")}?path={quote(child_rel)}'
            icon = ICONS.get(kind, ICONS["file"])
            try:
                size = p.stat().st_size
                meta = f'<span class="pill">{format_bytes(size)}</span>'
            except Exception:
                meta = ""

        items_html.append(
            f'<a class="item" href="{link}">'
            f'<div class="icon">{icon}</div>'
            f'<div>{escape_html(name)} {"<span class=\\"badge\\">(folder)</span>" if p.is_dir() else ""}</div>'
            f'<div class="spacer"></div>'
            f'{meta}'
            f'</a>'
        )

    body = f"""
    <div class="crumbs">{' '.join(crumbs)}</div>
    {f'<div style="margin-bottom:10px"><a href="{url_for("browse")}?path={quote(parent_rel)}">⬅ Go up</a></div>' if parts else ''}
    <div class="grid">{''.join(items_html) if items_html else '<div class="muted">(Empty)</div>'}</div>
    """
    return page("Browse", body)

@app.route("/watch")
@requires_auth
def watch():
    rel = request.args.get("path", "").strip()
    try:
        target = safe_join(MEDIA_ROOT, rel)
    except ValueError:
        abort(400, "Invalid path")

    if not target.exists() or not target.is_file():
        abort(404, "File not found")

    kind, mtype = classify(target)
    title = target.name

    if kind == "video":
        player = f'<video controls preload="metadata" src="{url_for("stream")}?path={quote(rel)}"></video>'
    elif kind == "audio":
        player = f'<audio controls preload="metadata" src="{url_for("stream")}?path={quote(rel)}"></audio>'
    else:
        return redirect(f'{url_for("raw")}?path={quote(rel)}')

    body = f"""
    <div class="topbar">
      <div><a href="{url_for("browse")}?path={quote(str(Path(rel).parent).replace('.', ''))}">⬅ Back</a></div>
      <div class="muted">{escape_html(mtype)}</div>
    </div>
    <div class="player">
      <h2 style="margin:6px 0 12px 0">{escape_html(title)}</h2>
      {player}
    </div>
    <div style="margin-top:12px">
      <a class="pill" href="{url_for("raw")}?path={quote(rel)}" download>⬇ Download</a>
    </div>
    """
    return page(f"Watch: {title}", body)

@app.route("/raw")
@requires_auth
def raw():
    rel = request.args.get("path", "").strip()
    try:
        target = safe_join(MEDIA_ROOT, rel)
    except ValueError:
        abort(400, "Invalid path")
    if not target.exists() or not target.is_file():
        abort(404, "File not found")

    mtype, _ = mimetypes.guess_type(str(target))
    mtype = mtype or "application/octet-stream"
    def generate():
        with open(target, "rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                yield chunk
    resp = Response(generate(), mimetype=mtype)
    return resp

@app.route("/stream")
@requires_auth
def stream():
    rel = request.args.get("path", "").strip()
    try:
        target = safe_join(MEDIA_ROOT, rel)
    except ValueError:
        abort(400, "Invalid path")
    if not target.exists() or not target.is_file():
        abort(404, "File not found")

    file_size = target.stat().st_size
    range_header = request.headers.get("Range", None)
    mtype, _ = mimetypes.guess_type(str(target))
    mtype = mtype or "application/octet-stream"

    if range_header is None:
        # No range: send entire file (some players still allow seeking afterward)
        def generate():
            with open(target, "rb") as f:
                while True:
                    chunk = f.read(1024 * 1024)
                    if not chunk:
                        break
                    yield chunk
        headers = {
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
        }
        return Response(generate(), status=200, headers=headers, mimetype=mtype)

    # Parse Range: bytes=start-end
    try:
        units, rng = range_header.strip().split("=", 1)
        if units != "bytes":
            raise ValueError
        start_s, end_s = (rng.split("-", 1) + [""])[:2]
        if start_s == "":
            # suffix range: bytes=-N
            length = int(end_s)
            if length <= 0:
                raise ValueError
            start = max(0, file_size - length)
            end = file_size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s != "" else file_size - 1
        if start < 0 or end >= file_size or start > end:
            raise ValueError
    except Exception:
        # Invalid range
        headers = {"Content-Range": f"bytes */{file_size}"}
        return Response(status=416, headers=headers)

    chunk_size = (end - start) + 1

    def generate():
        with open(target, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            bufsize = 1024 * 1024
            while remaining > 0:
                read_size = min(bufsize, remaining)
                data = f.read(read_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Cache-Control": "private, max-age=0, must-revalidate",
    }
    return Response(generate(), status=206, headers=headers, mimetype=mtype)

@app.errorhandler(404)
def not_found(e):
    return make_response("Not found", 404)

@app.errorhandler(400)
def bad_request(e):
    return make_response(str(e), 400)

if __name__ == "__main__":
    print(f"[OK] HDD Streamer running at http://{HOST}:{PORT}")
    print(f"[OK] Media root: {MEDIA_ROOT}")
    if AUTH_USER and AUTH_PASS:
        print("[SECURITY] Basic Auth enabled")
    app.run(host=HOST, port=PORT, threaded=True)  # threaded allows parallel range requests
