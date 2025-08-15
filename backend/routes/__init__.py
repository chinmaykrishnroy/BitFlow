# backend/routes/__init__.py
from .stream import stream_bp
from .download import download_bp

__all__ = ["stream_bp", "download_bp"]
