import { Router } from "express";
import {
  getVisitors,
  createVisitor,
  exitVisitor,
} from "../controllers/visitorController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Ziyaretçi listesi (İçeridekiler & Geçmiş) - Yetkili kullanıcılar
router.get("/", requireAuth, getVisitors);

// Yeni Ziyaretçi Kaydı (QR ile dış ziyaretçiler veya Güvenlik Manuel) - Herkese Açık (Public)
router.post("/", createVisitor);

// Ziyaretçi Çıkış İşlemi - Yetkili kullanıcılar
router.put("/:id/exit", requireAuth, exitVisitor);

export default router;
