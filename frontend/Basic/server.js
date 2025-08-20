const { getOutboundIP } = require("./get_ip");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 9999;
const BASE_DIR = __dirname;

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html";
    case ".css": return "text/css";
    case ".js": return "application/javascript";
    case ".json": return "application/json";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    default: return "text/plain";
  }
}

const server = http.createServer((req, res) => {
  let filePath = path.join(BASE_DIR, req.url === "/" ? "index.html" : req.url);
  
  // Prevent directory traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    return res.end("403 Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try serving 404.html
      fs.readFile(path.join(BASE_DIR, "404.html"), (err404, data404) => {
        if (err404) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
        } else {
          res.writeHead(404, { "Content-Type": "text/html" });
          res.end(data404);
        }
      });
    } else {
      res.writeHead(200, {
        "Content-Type": getContentType(filePath),
        "Cache-Control": "public, max-age=3600"
      });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  getOutboundIP((err, ip) => {
    const url = `http://${err ? "localhost" : ip}:${PORT}`;
    console.log(`Server running at ${url}`);

    // Open browser
    const start =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
        ? "start"
        : "xdg-open";

    exec(`${start} ${url}`);
  });
});
