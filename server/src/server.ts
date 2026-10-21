import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { sequelize, Status } from "./models";
import authRoutes from "./routes/authRoutes";
import personnelRoutes from "./routes/personnelRoutes";
import leaveRoutes from "./routes/leaveRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import calendarRoutes from "./routes/calendarRoutes";
import ratesRoutes from "./routes/ratesRoutes";
import foodMenuRoutes from "./routes/foodMenuRoutes";
import mesRoutes from "./routes/mesRoutes";
import phoneDirectoryRoutes from "./routes/phoneDirectoryRoutes";
import gameRoutes from "./routes/gameRoutes";
import documentRoutes from "./routes/documentRoutes";
import exportRoutes from "./routes/exportRoutes";
import { startLeaveBalanceSyncScheduler } from "./services/leaveBalanceSyncScheduler";
import itRequestRoutes from "./routes/itRequestRoutes";
import scrapTrackingRoutes from "./routes/scrapTrackingRoutes";
import visitorRoutes from "./routes/visitorRoutes";
import visitorContactRoutes from "./routes/visitorContactRoutes";
import { ensureApplicationSchema } from "./services/schemaMigrationService";
import path from "path";
import fs from "fs";

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

// Middleware
app.use(express.json());
app.use(cookieParser());

const corsOptions: cors.CorsOptions = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Kiosk-Key"],
};

app.use(cors(corsOptions));

// Standalone Ziyaretci Formu
const standaloneDir = fs.existsSync(path.join(process.cwd(), "visitor-form-standalone"))
  ? path.join(process.cwd(), "visitor-form-standalone")
  : path.join(__dirname, "../../visitor-form-standalone");
app.use("/qr", express.static(standaloneDir));



// Routes
app.use("/api/auth", authRoutes);
app.use("/api/personnel", personnelRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/rates", ratesRoutes);
app.use("/api/food-menu", foodMenuRoutes);
app.use("/api/mes", mesRoutes);
app.use("/api/phone-directory", phoneDirectoryRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/it-requests", itRequestRoutes);
app.use("/api/scrap-tracking", scrapTrackingRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/visitor-contacts", visitorContactRoutes);
app.use("/api/export", exportRoutes);

// Fotoğrafları frontend için /photos adresi ile dışarı aç
const photoPath =
  process.env.PHOTO_STORAGE_PATH ||
  path.join(process.env.USERPROFILE || "C:", "Desktop", "PersonelFotograflari");
if (!fs.existsSync(photoPath)) {
  fs.mkdirSync(photoPath, { recursive: true });
}
app.use("/photos", express.static(photoPath));

// IT destek sohbeti ekran görüntülerini frontend için /it-attachments adresi ile dışarı aç
const itAttachmentPath =
  process.env.IT_ATTACHMENT_STORAGE_PATH ||
  path.join(process.env.USERPROFILE || "C:", "Desktop", "ITDestekFotograflari");
if (!fs.existsSync(itAttachmentPath)) {
  fs.mkdirSync(itAttachmentPath, { recursive: true });
}
app.use("/it-attachments", express.static(itAttachmentPath));

// Dökümanları tarayıcıdan doğrudan önizlemek için dışarı aç
const documentPath =
  process.env.DOCUMENT_STORAGE_PATH ||
  path.join(__dirname, "../uploads/documents");
if (!fs.existsSync(documentPath)) {
  fs.mkdirSync(documentPath, { recursive: true });
}
app.use("/uploads/documents", express.static(documentPath));

// Hurda görsellerini dışarı aç
const scrapImagePath =
  process.env.SCRAP_IMAGE_STORAGE_PATH ||
  path.join(__dirname, "../uploads/scrap-images");
if (!fs.existsSync(scrapImagePath)) {
  fs.mkdirSync(scrapImagePath, { recursive: true });
}
app.use("/uploads/scrap-images", express.static(scrapImagePath));

// DB bağlantısı ve sunucu başlatma
const startServer = async () => {
  try {
    await sequelize.authenticate();
    await ensureApplicationSchema();
    await sequelize.sync();

    // Statik İş Durumlarını Veritabanına Ekle (Seed) - MSSQL Uyumlu Yöntem
    const statuses = [
      { id: 1, name: "Aktif İş", color_code: "text-emerald-500 bg-emerald-500/10" },
      { id: 2, name: "Durdurulan İş", color_code: "text-yellow-500 bg-yellow-500/10" },
      { id: 3, name: "İptal Edilen İş", color_code: "text-red-500 bg-red-500/10" },
      { id: 4, name: "Tamamlanan İş", color_code: "text-blue-500 bg-blue-500/10" }
    ];

    for (const s of statuses) {
      const [statusItem, created] = await Status.findOrCreate({
        where: { id: s.id },
        defaults: s
      });
      if (!created) {
        await statusItem.update(s);
      }
    }

    startLeaveBalanceSyncScheduler();

    const startListening = (portToTry: number) => {
      const server = app
        .listen(portToTry, () => {
          console.log(`Server is running on port ${portToTry}...`);
        })
        .on("error", (err: any) => {
          if (err.code === "EADDRINUSE") {
            if (portToTry === 3003) {
              console.warn(`Port 3003 is busy, trying port 3005...`);
              startListening(3005);
            } else {
              console.error(`!!! PORT ${portToTry} IS ALSO IN USE !!!`);
              process.exit(1);
            }
          } else {
            console.error("Server error:", err);
          }
        });
    };

    const initialPort = Number(process.env.PORT) || 3003;
    startListening(initialPort);
  } catch (error) {
    console.error("Database connection or Sync error:", error);
  }
};

startServer();

export default app;
