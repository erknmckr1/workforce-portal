import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as documentController from "../controllers/documentController";
import { requireAuth, requireRoles } from "../middlewares/authMiddleware";

const router = Router();

// Multer Disk Storage Yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir =
      process.env.DOCUMENT_STORAGE_PATH ||
      path.join(__dirname, "../../uploads/documents");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    // Güvenli dosya adı oluşturma (Türkçe karakterler ve boşluklar temizlenir)
    const safeName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, "_");
    cb(null, `${uniqueSuffix}-${safeName}${ext}`);
  },
});

// Sadece PDF filtrelemesi
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Yalnızca PDF dökümanları yüklenebilir."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB Limit
  },
});

// Multer hata yakalayıcı ara katmanı
const handleMulterUpload = (req: any, res: any, next: any) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Rotalar
// Giriş yapan tüm personeller dökümanları listeleyebilir/görüntüleyebilir
router.get("/", requireAuth, documentController.getDocuments);

// Döküman yükleme ve silme sadece Admin (7) ve İK (4) yetkisine sahip kullanıcılar içindir
router.post(
  "/",
  requireAuth,
  requireRoles([7, 4]),
  handleMulterUpload,
  documentController.uploadDocument
);

router.delete(
  "/:id",
  requireAuth,
  requireRoles([7, 4]),
  documentController.deleteDocument
);

export default router;
