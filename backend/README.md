Streamer/
│
├── backend/
│ ├── app.py # Flask entry point
│ ├── config.py # Configuration (e.g., MEDIA_ROOT)
│ ├── requirements.txt # Python dependencies
│ │
│ ├── routes/
│ │ ├── **init**.py
│ │ ├── files.py # HTTP endpoints for file listing
│ │ ├── stream.py # HTTP endpoints for streaming
│ │
│ ├── sockets/
│ │ ├── **init**.py
│ │ ├── file_events.py # WebSocket events for navigation, updates
│ │
│ ├── utils/
│ ├── **init**.py
│ ├── file_utils.py # Helpers for listing folders/files
│ ├── stream_utils.py # Helpers for chunked streaming
│
├── frontend/ # (empty for now)
│
└── venv/ # Virtual environment
