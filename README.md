# BitFlow

Stream or download files from any directory you love, in secure, bite-sized chunks.
Share access without giving away the keys to your entire drive. 

---

## What is this repo for?

BitFlow is your personal, portable file-sharing wizard.

* Host any directory on your computer and stream/download files from it.
* Keep things fast, safe, and efficient with chunked transfers.
* Share access with friends or devices without exposing your whole drive.

Perfect for tech-savvy humans who hate clunky file servers. Or anyone who just wants to feel like a hacker from a movie.

---

## Getting Started

### The Easy-Peasy Install

1. Double-click `install.bat`.
2. Give it permission (Windows will ask if you’re sure… just say "Yes, trust me, I’m no hacker").
3. Like magic, it creates two shiny shortcuts in the same folder:

   * **run\_this\_to\_open\_backend** → Starts the server (the backend wizard).
   * **run\_this\_to\_open\_frontend** → Opens the file explorer frontend.
4. First time you run those shortcuts, Windows will again say "are you sure?" → Yes, we’re sure. Hit allow.
5. Done. You’re now the ruler of your own file-sharing empire.

That’s it. You’re done.

---

## Backend (Server Side)

If you’re curious about what’s happening behind the curtain (or you don’t trust shortcuts), here’s the technical stuff:

* Open `backend/config.py` and set `MEDIA_ROOT` to the folder you want to share.

  * Default is the user directory.
  * Example:

    ```python
    MEDIA_ROOT = "/path/to/your/favorite/files"
    ```

* `backend/app.py` – The main Flask app. Sets up Socket.IO, registers routes, and starts the server.
* `backend/sockets/` – Handles real-time events (files requested? Streamed live).
* `backend/routes/` – Blueprints for:

  * `/stream` → Streaming your files like Netflix, but only starring your cat videos.
  * `/download` → Chunked, safe downloads.
* `backend/config.py` – Customize server port, CORS rules, debug mode, file size limits.
* `backend/*_utils.py` – Helpers for metadata, MIME types, playable checks, etc.

Basically, everything is modular, neat, and doesn’t explode (usually).

---

## Frontend (Client Side)

BitFlow ships with a file manager frontend.

### Full Featured (Fancy) Frontend

* After install, just double-click your `run_this_to_open_frontend` shortcut.
* Hosts your file explorer at `localhost:9999`.
* Features:

  * Dark and light themes.
  * Responsive design (works nicely on phones too).
  * File icons by type.
  * Stream images, audio, video in a popup.
  * Download with a single click.
  * Hover effects, animations, and smooth design.

### No Node.js? No problem

* `frontend/basic/index.html` → Runs in your browser without Node.js.
* `frontend/minimal.html` → Old-school lightweight, table-based explorer.

---

## How it Works

1. Backend (Flask + Socket.IO) serves your files on port **8888**.
2. Frontend connects → lists directories → streams/downloads files.
3. Optional Node.js server hosts the fancy UI on port **9999**.
4. Or, minimal HTML works without Node.js.

---

## TL;DR

* **Install**: Run `install.bat` → get shortcuts → done.
* **Backend**: Flask + Socket.IO = your files, but faster.
* **Frontend**: Fancy dark/light file manager or minimal HTML explorer.
* **Use**: Stream, download, or share securely.
* **Goal**: Be the boss of your own files, avoid messy sharing apps, and feel like a tech wizard while doing it.

---

Made with love, Python, Node.js, and a sprinkle of hacker magic.
