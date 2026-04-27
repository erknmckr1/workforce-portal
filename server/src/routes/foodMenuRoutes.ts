import { Router } from "express";
import * as foodMenuController from "../controllers/foodMenuController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Herkese Açık Rotalar (Ana Sayfa İçin)
router.get("/monthly", foodMenuController.getMonthlyMenu);
router.get("/today", foodMenuController.getTodayMenu);

// Korumalı Rotalar (Admin/İK İçin)
router.post("/update", requireAuth, foodMenuController.updateDailyMenu);
router.post("/bulk-update", requireAuth, foodMenuController.bulkUpdateMenu);

export default router;
