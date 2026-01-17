import os
import socket
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import unquote
import webbrowser

# --- Configuration ---
PORT = 9999
# Fix: Use __file__ with underscores
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to a public DNS to find the correct local IP
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()

class CustomHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = unquote(path)
        if path == "/":
            path = "/index.html"
        
        # Remove leading slash and resolve path
        path = path.lstrip("/")
        requested_path = os.path.normpath(os.path.join(BASE_DIR, path))

        # Security: Prevent accessing files outside BASE_DIR
        if not requested_path.startswith(BASE_DIR):
            return None
        return requested_path

    def do_GET(self):
        file_path = self.translate_path(self.path)

        # 404 Handling
        if file_path is None or not os.path.exists(file_path):
            not_found_file = os.path.join(BASE_DIR, "404.html")
            self.send_response(404)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            
            if os.path.exists(not_found_file):
                with open(not_found_file, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b"404 Not Found")
            return

        # Serve File
        content_type, _ = mimetypes.guess_type(file_path)
        if content_type is None:
            content_type = "text/plain"
            
        self.send_response(200)
        self.send_header("Content-type", content_type)
        self.send_header("Cache-Control", "no-cache") 
        self.end_headers()
        
        with open(file_path, "rb") as f:
            self.wfile.write(f.read())

# Fix: Use __name__ with underscores
if __name__ == "__main__":
    server_address = ("", PORT) 
    httpd = HTTPServer(server_address, CustomHandler)

    ip = get_local_ip()
    
    print("-" * 30)
    print(f" SERVER RUNNING")
    print("-" * 30)
    print(f"1. On this phone: http://localhost:{PORT}")
    print(f"2. ON YOUR PC:    http://{ip}:{PORT}")
    print("-" * 30)
    print("KEEP THIS APP OPEN. DO NOT LOCK SCREEN.")
    
    try:
        webbrowser.open(url)
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        httpd.server_close()
