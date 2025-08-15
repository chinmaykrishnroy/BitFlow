# backend/sockets/__init__.py
from .file_events import register_file_events

def register_socket_events(socketio):
    """
    Register all socket event handlers.
    This ensures the server knows how to handle real-time events.
    """
    register_file_events(socketio)

__all__ = ["register_socket_events"]
