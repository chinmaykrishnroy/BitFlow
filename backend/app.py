# backend/app.py
from flask import Flask
from flask_socketio import SocketIO
import config  # Your config module
from sockets import register_socket_events
from routes import stream_bp, download_bp
from utils import get_local_ip

# Flask setup
app = Flask(__name__)

# Apply config values
app.config["DEBUG"] = config.DEBUG
app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH

# Socket.IO setup
socketio = SocketIO(app, cors_allowed_origins=config.CORS_ALLOWED_ORIGINS)

# Register all socket events
register_socket_events(socketio)

# Register blueprints
app.register_blueprint(stream_bp, url_prefix="/stream")
app.register_blueprint(download_bp, url_prefix="/download")

if __name__ == "__main__":
    print(f"Server running at http://{get_local_ip()}:{config.PORT}")
    socketio.run(app, host=config.HOST, port=config.PORT)
