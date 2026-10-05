const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const PORT = process.env.PORT || 9199;
const HOST = "127.0.0.1";
const SCRIPT_PATH = path.resolve(__dirname, "sendZplToPrinter.ps1");

const setCorsHeaders = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === "GET" && (req.url === "/" || req.url === "/health" || req.url === "/status")) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "Workforce Zebra Print Agent",
        port: PORT,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Print endpoint
  if (req.method === "POST" && req.url === "/print") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "İstek boyutu çok büyük" }));
        req.destroy();
      }
    });

    req.on("end", () => {
      let data = {};
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Geçersiz JSON verisi." }));
        return;
      }

      const { printerName = "MIDAS_BARKOD", zpl } = data;
      if (!zpl || typeof zpl !== "string" || !zpl.trim()) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "ZPL içeriği zorunludur." }));
        return;
      }

      const tempFile = path.join(
        os.tmpdir(),
        `zebra_agent_${Date.now()}_${Math.random().toString(36).substring(7)}.zpl`
      );

      fs.writeFileSync(tempFile, zpl, "utf8");

      execFile(
        "powershell",
        [
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          SCRIPT_PATH,
          "-PrinterName",
          String(printerName).trim() || "MIDAS_BARKOD",
          "-ZplFile",
          tempFile,
        ],
        (error, stdout, stderr) => {
          // Clean up temp file
          try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          } catch {}

          if (error) {
            console.error(
              `[Print Error] ${new Date().toLocaleTimeString()} - Hata:`,
              stderr || error.message
            );
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
            res.end(
              JSON.stringify({
                success: false,
                message: "Yazıcıya gönderilemedi: " + (stderr || error.message),
              })
            );
            return;
          }

          console.log(
            `[Print Success] ${new Date().toLocaleTimeString()} - Yazıcı: ${printerName} - Boyut: ${zpl.length} bayt`
          );
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              success: true,
              message: "Etiket yazıcıya başarıyla gönderildi.",
            })
          );
        }
      );
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: false, message: "Bulunamadı" }));
});

server.listen(PORT, HOST, () => {
  console.log("==================================================");
  console.log("  Workforce Yerel Zebra Yazdırma Ajanı Aktif!");
  console.log(`  Adres: http://${HOST}:${PORT}`);
  console.log("  Durum: Bekleniyor (Hazır)");
  console.log("==================================================");
});
