# backend/utils/file_utils.py
import os
import mimetypes
import datetime
import platform
from pathlib import Path
import config
from concurrent.futures import ThreadPoolExecutor

# Only import pwd/grp if on a POSIX system
if platform.system() != "Windows":
    import pwd
    import grp
else:
    pwd = None
    grp = None

executor = ThreadPoolExecutor(max_workers=4)

# ---------------------------
# Path helpers
# ---------------------------

def _normalize_logical(logical_path: str) -> str:
    if not logical_path:
        return "/"
    logical_path = logical_path.strip()
    if not logical_path.startswith("/"):
        logical_path = "/" + logical_path
    if len(logical_path) > 1 and logical_path.endswith("/"):
        logical_path = logical_path[:-1]
    return logical_path

def logical_to_real_path(logical_path: str) -> Path:
    logical_path = _normalize_logical(logical_path)
    real_path = Path(config.MEDIA_ROOT) / logical_path.lstrip("/")
    try:
        real_path = real_path.resolve(strict=False)
        media_root_resolved = Path(config.MEDIA_ROOT).resolve(strict=True)
        if not str(real_path).startswith(str(media_root_resolved)):
            raise ValueError("Invalid path (outside MEDIA_ROOT)")
    except Exception as e:
        raise ValueError(f"Invalid path: {e}")
    return real_path

# ---------------------------
# Metadata helpers
# ---------------------------

def format_time(timestamp: float | None) -> str | None:
    if timestamp is None:
        return None
    return datetime.datetime.fromtimestamp(timestamp).isoformat()

def get_file_metadata(path: Path) -> dict:
    try:
        stat = path.stat()
        mime_type, _ = mimetypes.guess_type(str(path))
        return {
            "name": path.name,
            "extension": path.suffix.lower(),
            "filetype": mime_type or "application/octet-stream",
            "size": stat.st_size,
            "modified": format_time(stat.st_mtime),
            "created": format_time(stat.st_ctime),
            "accessed": format_time(stat.st_atime),
            "permissions": oct(stat.st_mode & 0o777),
            "owner": pwd.getpwuid(stat.st_uid).pw_name if pwd else None,
            "group": grp.getgrgid(stat.st_gid).gr_name if grp else None,
            "readonly": not os.access(path, os.W_OK),
            "hidden": path.name.startswith("."),
            "is_symlink": path.is_symlink(),
        }
    except Exception as e:
        return {"name": path.name, "error": str(e)}

def get_dir_metadata(path: Path) -> dict:
    try:
        stat = path.stat()
        try:
            count = sum(1 for _ in path.iterdir() if not _.name.startswith("."))
        except Exception:
            count = None
        return {
            "name": path.name if path.name else "/",
            "count": count,
            "modified": format_time(stat.st_mtime),
            "created": format_time(stat.st_ctime),
            "accessed": format_time(stat.st_atime),
            "permissions": oct(stat.st_mode & 0o777),
            "owner": pwd.getpwuid(stat.st_uid).pw_name if pwd else None,
            "group": grp.getgrgid(stat.st_gid).gr_name if grp else None,
            "readonly": not os.access(path, os.W_OK),
            "hidden": path.name.startswith("."),
            "is_symlink": path.is_symlink(),
        }
    except Exception as e:
        return {"name": path.name if path.name else "/", "error": str(e)}

# ---------------------------
# Directory listing (sync)
# ---------------------------

def list_directory_sync(logical_path: str) -> dict:
    logical_path = _normalize_logical(logical_path)
    real_path = logical_to_real_path(logical_path)

    if not real_path.exists():
        raise FileNotFoundError(f"Path '{logical_path}' does not exist")
    if not real_path.is_dir():
        return {"path": logical_path, "type": "file", "details": get_file_metadata(real_path)}

    children = []
    for entry in sorted(real_path.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        if entry.name.startswith("."):
            continue
        child_logical_path = f"{logical_path.rstrip('/')}/{entry.name}" if logical_path != "/" else f"/{entry.name}"
        children.append({
            "path": child_logical_path,
            "type": "directory" if entry.is_dir() else "file",
            "details": get_dir_metadata(entry) if entry.is_dir() else get_file_metadata(entry)
        })

    return {
        "path": logical_path,
        "type": "directory",
        "details": get_dir_metadata(real_path),
        "children": children
    }

# ---------------------------
# Directory listing with progress
# ---------------------------

def list_directory_with_progress(logical_path: str, batch_size: int = 200, progress_cb=None) -> dict:
    logical_path = _normalize_logical(logical_path)
    real_path = logical_to_real_path(logical_path)

    if not real_path.exists():
        raise FileNotFoundError(f"Path '{logical_path}' does not exist")
    if not real_path.is_dir():
        return {"path": logical_path, "type": "file", "details": get_file_metadata(real_path)}

    try:
        total = sum(1 for _ in os.scandir(real_path) if _.name and not _.name.startswith("."))
    except Exception:
        total = None

    scanned = 0
    children = []
    batch = []

    for dirent in sorted(Path(real_path).iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        if dirent.name.startswith("."):
            continue
        child_logical_path = f"{logical_path.rstrip('/')}/{dirent.name}" if logical_path != "/" else f"/{dirent.name}"
        item = {
            "path": child_logical_path,
            "type": "directory" if dirent.is_dir() else "file",
            "details": get_dir_metadata(dirent) if dirent.is_dir() else get_file_metadata(dirent)
        }
        children.append(item)
        batch.append(item)
        scanned += 1

        if progress_cb and (len(batch) >= batch_size or (total and scanned == total)):
            percent = (scanned / total * 100.0) if (total and total > 0) else None
            progress_cb({"event": "progress", "path": logical_path, "scanned": scanned,
                         "total": total, "percent": percent, "batch": batch})
            batch = []

    if progress_cb and batch:
        percent = (scanned / total * 100.0) if (total and total > 0) else None
        progress_cb({"event": "progress", "path": logical_path, "scanned": scanned,
                     "total": total, "percent": percent, "batch": batch})

    result = {"path": logical_path, "type": "directory", "details": get_dir_metadata(real_path), "children": children}
    if progress_cb:
        progress_cb({"event": "done", "path": logical_path})

    return result

# ---------------------------
# Async wrappers
# ---------------------------

def list_directory_async(logical_path: str, callback):
    def task():
        try:
            result = list_directory_sync(logical_path)
            callback(result, None)
        except Exception as e:
            callback(None, str(e))
    executor.submit(task)

def list_directory_with_progress_async(logical_path: str, progress_cb, done_cb, batch_size: int = 200):
    def task():
        try:
            result = list_directory_with_progress(logical_path, batch_size=batch_size, progress_cb=progress_cb)
            done_cb(result, None)
        except Exception as e:
            done_cb(None, str(e))
    executor.submit(task)
