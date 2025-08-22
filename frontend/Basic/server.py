# server.py
import os
import socket
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import unquote
import webbrowser

PORT = 9999
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    finally:
        s.close()


class CustomHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Resolve file path relative to BASE_DIR
        path = unquote(path)
        if path == "/":
            path = "/index.html"
        requested_path = os.path.normpath(os.path.join(BASE_DIR, path.lstrip("/")))
        
        # Prevent directory traversal
        if not requested_path.startswith(BASE_DIR):
            return None
        return requested_path

    def do_GET(self):
        file_path = self.translate_path(self.path)
        if file_path is None or not os.path.exists(file_path):
            # Serve 404.html if exists
            not_found_file = os.path.join(BASE_DIR, "404.html")
            if os.path.exists(not_found_file):
                self.send_response(404)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                with open(not_found_file, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.send_header("Content-type", "text/plain")
                self.end_headers()
                self.wfile.write(b"404 Not Found")
            return

        content_type, _ = mimetypes.guess_type(file_path)
        if content_type is None:
            content_type = "text/plain"

        self.send_response(200)
        self.send_header("Content-type", content_type)
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()

        with open(file_path, "rb") as f:
            self.wfile.write(f.read())


if __name__ == "__main__":
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, CustomHandler)

    try:
        ip = get_local_ip()
    except Exception:
        ip = "localhost"

    url = f"http://{ip}:{PORT}"
    print(f"Server running at {url}")

    webbrowser.open(url)

    httpd.serve_forever()
