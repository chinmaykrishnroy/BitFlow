# BitFlow 🚀

**Stream or download files from any directory you love**, in secure, bite-sized chunks. Share access without giving away the keys to your entire drive. Basically, it’s like file-sharing on steroids, but totally under your control. 💪

---

## What is this repo for? 🤔

BitFlow is your personal, portable file-sharing wizard.  
- Host any directory on your computer and stream/download files from it.  
- Keep things fast, safe, and efficient with chunked transfers.  
- Share access with friends or devices without exposing your whole drive.  

Perfect for tech-savvy humans who hate clunky file servers. Or anyone who just wants to feel like a hacker from a movie. 🕶️

---

## Getting Started 🏃‍♂️

### Prerequisites
- **Python 3.x** (for backend server)
- **Node.js** (if you want to use the hosted frontend)
- Basic knowledge of clicking files (you got this!)

---

### Backend (Server Side) ⚡

1. Open `backend/config.py` and set `MEDIA_ROOT` to the folder you actually want to share.  
   ```python
   MEDIA_ROOT = "/path/to/your/favorite/files"
*Pro tip:* Comment the old line, add the new one, make it clean.

2. Run the backend server (by clicking on this file):

   ```bash
   run_backend_server.bat
   ```

   This will start the Flask + Socket.IO server on **port 8888**.
   It automatically serves files from your chosen `MEDIA_ROOT` over the network.

---
<img width="785" height="541" alt="image" src="https://github.com/user-attachments/assets/8ad9e05f-8e7c-412b-84b1-5bc5a3da0826" />

### Server-side Magic ✨

* `backend/app.py` – The main Flask app. Sets up Socket.IO, registers routes, and starts the server.

* `backend/sockets/` – Handles all real-time events. Files being requested? Streamed live.

* `backend/routes/` – Blueprints for:

  * `/stream` → Streaming your files like a Netflix for your own files.
  * `/download` → Downloading chunks safely.

* `backend/config.py` – Customize:

  * Server port (`PORT`)
  * CORS rules (`CORS_ALLOWED_ORIGINS`)
  * Debug mode (`DEBUG`)
  * Max file size (`MAX_CONTENT_LENGTH`)

* `backend/*_utils.py` – All the hidden helpers making sure your files behave nicely: metadata, MIME types, playable checks, etc.

Basically, **everything is modular, neat, and does its thing** without crashing your vibe.

---

## Frontend (Client Side) 🌐

BitFlow comes with a slick **file manager frontend** to make browsing your files fun:

### Full Featured (Fancy) Frontend

* Run it (by clicking on this file), but you must have Node.js:

  ```bash
  run_frontend.bat
  ```

* Hosts your file explorer at **localhost:9999**.

<img width="707" height="455" alt="image" src="https://github.com/user-attachments/assets/44604b58-39cb-4b95-bafe-5629c955dff4" />

* **Don’t have Node.js? No worries.** Just open (by clicking on below file):

  ```
  frontend/basic/index.html
  ```

* Features:

  * Beautiful dark-themed file grid
  * Navigation buttons (Back / Forward)
  * Live search for files/folders
  * File icons by type: 📁, 📄, 🎵, 🎬, 🖼️
  * Stream images, audio, and video in a popup window
  * Download files with a single click
  * Hover effects, subtle animations, and totally Instagram-worthy vibes

* **Pro tip:** Change the host in `script.js` (the first line of this file) if you want to access your server from other devices.

---

### Minimal Frontend

* want more simple? No worries. Just open:

  ```
  frontend/minimal.html
  ```

* Provides a simpler, table-based file explorer with:

  * File/folder names, types, size, modified date
  * Clickable folders to navigate
  * Download & Stream buttons

* Great for old-school lovers or lightweight usage. 🧑‍💻

---

## How it Works 🎩

1. Backend serves your files via **Flask + Socket.IO** on port 8888.
2. Frontend connects to the backend, lists directories, and allows:

   * Streaming supported media files (images, audio, video)
   * Downloading files in secure chunks
   * Searching and navigating folders
3. Optional Node.js server hosts a fully interactive frontend on port 9999.
4. Minimal HTML version works without Node.js - perfect for quick launches.

---

### TL;DR 📝

* **Backend:** Flask + Socket.IO, serves files from any directory.
* **Frontend:** Beautiful file manager or lightweight HTML table.
* **Use:** Stream, download, or share your files securely.
* **Goal:** Be the boss of your own files, avoid messy sharing apps, and feel like a tech wizard while doing it.

---

Made with ❤️, Python 🐍, Node.js ⚡, and a bit of hacker magic ✨


