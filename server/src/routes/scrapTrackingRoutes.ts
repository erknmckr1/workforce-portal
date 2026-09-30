import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getScrapTrackings,
  getScrapTrackingById,
  createScrapTracking,
  updateScrapTracking,
  deleteScrapTracking,
  getSapOrderInfo,
} from "../controllers/scrapTrackingController";

const router = Router();

// Multer Storage Yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir =
      process.env.SCRAP_IMAGE_STORAGE_PATH ||
      path.join(__dirname, "../../uploads/scrap-images");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, "_");
    cb(null, `hurda_${uniqueSuffix}_${safeName}${ext}`);
  },
});

// Sadece görsel (JPEG, PNG, WEBP) filtrelemesi
const fileFilter = (req: any, file: any, cb: any) => {
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
    fileSize: 15 * 1024 * 1024, // 15 MB Limit
  },
});

const handleMulterUpload = (req: any, res: any, next: any) => {
  upload.single("image")(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

router.get("/", getScrapTrackings);
router.get("/order/:orderNo", getSapOrderInfo);
router.get("/:id", getScrapTrackingById);
router.post("/", handleMulterUpload, createScrapTracking);
router.put("/:id", handleMulterUpload, updateScrapTracking);
router.delete("/:id", deleteScrapTracking);

export default router;
