import { Router } from "express";
import {
  getAllSurveys,
  getActiveSurveys,
  createSurvey,
  updateSurvey,
  toggleSurveyStatus,
  deleteSurvey,
} from "../controllers/surveyController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// MES, Kiosk ve Portal için aktif anketler (Auth gerektirmez)
router.get("/active", getActiveSurveys);

// Ayarlar Paneli: Tüm anketler
router.get("/", requireAuth, getAllSurveys);

// Yeni anket ekleme
router.post("/", requireAuth, createSurvey);

// Anket güncelleme
router.put("/:id", requireAuth, updateSurvey);

// Durum değiştirme (Aktif / Pasif)
router.patch("/:id/toggle", requireAuth, toggleSurveyStatus);

// Anket silme
router.delete("/:id", requireAuth, deleteSurvey);

export default router;
