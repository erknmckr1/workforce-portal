import { Router } from "express";
import {
  getAllSurveys,
  getActiveSurveys,
  createSurvey,
  updateSurvey,
  toggleSurveyStatus,
  deleteSurvey,
} from "../controllers/surveyController";
import { requireAuth, requireRoles } from "../middlewares/authMiddleware";

const router = Router();

// MES, Kiosk ve Portal için aktif anketler (Auth gerektirmez)
router.get("/active", getActiveSurveys);

// Ayarlar Paneli: Tüm anketler
router.get("/", requireAuth, requireRoles([7, 4, 2, 3, 8]), getAllSurveys);

// Yeni anket ekleme
router.post("/", requireAuth, requireRoles([7, 4, 2, 3, 8]), createSurvey);

// Anket güncelleme
router.put("/:id", requireAuth, requireRoles([7, 4, 2, 3, 8]), updateSurvey);

// Durum değiştirme (Aktif / Pasif)
router.patch("/:id/toggle", requireAuth, requireRoles([7, 4, 2, 3, 8]), toggleSurveyStatus);

// Anket silme
router.delete("/:id", requireAuth, requireRoles([7, 4, 2, 3, 8]), deleteSurvey);

export default router;
