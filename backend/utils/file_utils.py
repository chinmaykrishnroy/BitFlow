# backend/utils/file_utils.py
import os
import mimetypes
import datetime
import pwd
import grp
from pathlib import Path
import config
from concurrent.futures import ThreadPoolExecutor

# Thread pool for heavy directory scans
executor = ThreadPoolExecutor(max_workers=4)


def logical_to_real_path(logical_path: str) -> Path:
    """
    Convert a logical path (like "/movies") to the real filesystem path
    under MEDIA_ROOT. Prevents path traversal.
    """
    if not logical_path or logical_path.strip() == "":
        logical_path = "/"

    logical_path = logical_path.strip()

    if not logical_path.startswith("/"):
        logical_path = "/" + logical_path

    relative_path = logical_path.lstrip("/")
    real_path = Path(config.MEDIA_ROOT) / relative_path

    try:
        real_path = real_path.resolve(strict=False)
        media_root_resolved = Path(config.MEDIA_ROOT).resolve(strict=True)
        if not str(real_path).startswith(str(media_root_resolved)):
            raise ValueError("Invalid path (outside MEDIA_ROOT)")
    except Exception as e:
        raise ValueError(f"Invalid path: {e}")

    return real_path


def format_time(timestamp: float) -> str:
    """Convert a UNIX timestamp to ISO format string."""
    return datetime.datetime.fromtimestamp(timestamp).isoformat()


def get_file_metadata(path: Path) -> dict:
    """Get safe metadata for a file."""
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
            "owner": pwd.getpwuid(stat.st_uid).pw_name if hasattr(pwd, "getpwuid") else None,
            "group": grp.getgrgid(stat.st_gid).gr_name if hasattr(grp, "getgrgid") else None,
            "readonly": not os.access(path, os.W_OK),
            "hidden": path.name.startswith("."),
            "is_symlink": path.is_symlink(),
        }
    except Exception as e:
        return {
            "name": path.name,
            "error": str(e)
        }


def get_dir_metadata(path: Path) -> dict:
    """Get safe metadata for a directory."""
    try:
        stat = path.stat()
        count = sum(1 for _ in path.iterdir() if not _.name.startswith("."))

        return {
            "name": path.name if path.name else "/",
            "count": count,
            "modified": format_time(stat.st_mtime),
            "created": format_time(stat.st_ctime),
            "accessed": format_time(stat.st_atime),
            "permissions": oct(stat.st_mode & 0o777),
            "owner": pwd.getpwuid(stat.st_uid).pw_name if hasattr(pwd, "getpwuid") else None,
            "group": grp.getgrgid(stat.st_gid).gr_name if hasattr(grp, "getgrgid") else None,
            "readonly": not os.access(path, os.W_OK),
            "hidden": path.name.startswith("."),
            "is_symlink": path.is_symlink(),
        }
    except Exception as e:
        return {
            "name": path.name if path.name else "/",
            "error": str(e)
        }


def list_directory_sync(logical_path: str) -> dict:
    """
    Synchronous directory listing.
    """
    real_path = logical_to_real_path(logical_path)

    if not real_path.exists():
        raise FileNotFoundError(f"Path '{logical_path}' does not exist")

    if not real_path.is_dir():
        return {
            "path": logical_path,
            "type": "file",
            "details": get_file_metadata(real_path)
        }

    try:
        children = []
        for entry in sorted(real_path.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
            if entry.name.startswith("."):
                continue  # Skip hidden
            child_logical_path = os.path.join(logical_path.rstrip("/"), entry.name)
            if entry.is_dir():
                children.append({
                    "path": child_logical_path,
                    "type": "directory",
                    "details": get_dir_metadata(entry)
                })
            else:
                children.append({
                    "path": child_logical_path,
                    "type": "file",
                    "details": get_file_metadata(entry)
                })

        return {
            "path": logical_path,
            "type": "directory",
            "details": get_dir_metadata(real_path),
            "children": children
        }
    except PermissionError:
        raise PermissionError(f"Permission denied: '{logical_path}'")
    except Exception as e:
        raise RuntimeError(f"Error listing directory: {e}")


def list_directory_async(logical_path: str, callback):
    """
    Run list_directory_sync in a background thread.
    Calls `callback(result, error)` when done.
    """
    def task():
        try:
            result = list_directory_sync(logical_path)
            callback(result, None)
        except Exception as e:
            callback(None, str(e))

    executor.submit(task)
