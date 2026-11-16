import { Router } from "express";
import {
  getQualityReportSummary,
  getQualityReportDetails,
} from "../controllers/qualityReportController";
import { requireAuth, requireRoles } from "../middlewares/authMiddleware";

const router = Router();

// Kalite Kontrol Raporu - Admin (7), Müdür (3), Yönetici (2), İK (4), Kalite Mühendisi (8), Mühendis (11)
const allowedRoles = [7, 3, 2, 4, 8, 11];

router.get("/summary", requireAuth, requireRoles(allowedRoles), getQualityReportSummary);
router.get("/details", requireAuth, requireRoles(allowedRoles), getQualityReportDetails);

export default router;
