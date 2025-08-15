from flask import Flask, jsonify
from flask_socketio import SocketIO
import os
import json
import config  # our new config module

# Flask setup
app = Flask(__name__)
# Apply config values
app.config["DEBUG"] = config.DEBUG
app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH

# Socket.IO setup
socketio = SocketIO(app, cors_allowed_origins=config.CORS_ALLOWED_ORIGINS)

# --- HTTP ROUTES ---
@app.route("/list", methods=["GET"])
def list_files():
    # For now, just return dummy data
    return jsonify({
        "status": "ok",
        "data": ["file1.mp4", "file2.mp3", "folder1/"],
        "media_root": config.MEDIA_ROOT
    })

# --- SOCKET EVENTS ---
@socketio.on('connect')
def handle_connect():
    socketio.emit('message', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    pass

@socketio.on('ping_server')
def handle_ping(data):
    socketio.emit('ping_server', {'msg': 'Pong from server!'})

# --- Generic unknown event handler ---
def handle_unknown_event(data):
    pass

# Example: dynamically register unknown events
for event_name in ["some_event", "other_event"]:  # extend this list
    socketio.on_event(event_name, handle_unknown_event)

if __name__ == "__main__":
    print(f"Starting server on port {config.PORT}...")
    socketio.run(app, host="0.0.0.0", port=config.PORT)
