import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getScrapTrackings,
  getScrapTrackingById,
  getScrapReport,
  createScrapTracking,
  updateScrapTracking,
  deleteScrapTracking,
  getSapOrderInfo,
  getScrapReasons,
} from "../controllers/scrapTrackingController";

const router = Router();

// Multer Storage Yapılandırması (Ağ Paylaşımı / Dosya Sunucusu Desteği)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir =
      process.env.SCRAP_IMAGE_STORAGE_PATH ||
      path.join(__dirname, "../../uploads/scrap-images");
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch (err) {
        console.warn("Hurda görselleri klasörü oluşturulamadı:", err);
      }
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 1. Sipariş No'yu al ve güvenli hale getir
    const rawOrder = (req.body.order_no || "").toString().trim();
    const cleanOrder = rawOrder.replace(/[^a-zA-Z0-9_-]/g, "") || "SIPARIS";

    // 2. Tel Kodu'nu al ve güvenli hale getir
    const rawWire = (req.body.wire_code || "").toString().trim();
    const cleanWire = rawWire.replace(/[^a-zA-Z0-9_-]/g, "");

    // 3. Tarih-Saat Damgası (YYYYMMDD-HHmmss)
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    // 4. Uzantı (.jpg, .png vb. - boşsa varsayılan .jpg)
    let ext = (path.extname(file.originalname) || "").toLowerCase();
    if (!ext || ext === ".") {
      ext = ".jpg";
    }

    // 5. Standart İsimlendirme: order_id-material_no_YYYYMMDD-HHmmss_rand.jpg
    const rand = Math.random().toString(36).substring(2, 7);
    const finalFilename = cleanWire
      ? `${cleanOrder}-${cleanWire}_${timestamp}_${rand}${ext}`
      : `${cleanOrder}_${timestamp}_${rand}${ext}`;

    cb(null, finalFilename);
  },
});

// Sadece görsel (JPEG, PNG, WEBP) filtrelemesi
const fileFilter = (_req: any, file: any, cb: any) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/webp" ||
    file.mimetype === "image/jpg"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Yalnızca resim (JPG, PNG, WEBP) formatları yüklenebilir."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB Limit (Orijinal yüksek çözünürlük için)
  },
});

const handleMulterUpload = (req: any, res: any, next: any) => {
  upload.any()(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

router.get("/", getScrapTrackings);
router.get("/report", getScrapReport);
router.get("/reasons", getScrapReasons);
router.get("/order/:orderNo", getSapOrderInfo);
router.get("/:id", getScrapTrackingById);
router.post("/", handleMulterUpload, createScrapTracking);
router.put("/:id", handleMulterUpload, updateScrapTracking);
router.delete("/:id", deleteScrapTracking);

export default router;
