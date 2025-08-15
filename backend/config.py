import os

# === FILE & MEDIA SETTINGS ===
# Default media directory is the current user's home directory
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", os.path.expanduser("~"))

# === SERVER SETTINGS ===
# Port to run the Flask-SocketIO server on
PORT = int(os.environ.get("PORT", 8888))

# Allowed origins for CORS (allow all for now)
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "*")

# === OTHER APP SETTINGS ===
# Debug mode
DEBUG = os.environ.get("DEBUG", "true").lower() == "true"

# Maximum file size for uploads (in bytes) — if needed later
MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 1024 * 1024 * 1024))  # 1 GB
