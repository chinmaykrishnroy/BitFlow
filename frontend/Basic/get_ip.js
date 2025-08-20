const dgram = require("dgram");

function getOutboundIP(cb) {
  const s = dgram.createSocket("udp4");
  s.connect(53, "8.8.8.8", () => {
    const ip = s.address().address;
    s.close();
    cb(null, ip);
  });
  s.on("error", (err) => cb(err));
}

module.exports = { getOutboundIP };
