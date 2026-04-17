import { Router } from "express";
import * as foodMenuController from "../controllers/foodMenuController";

const router = Router();

router.get("/monthly", foodMenuController.getMonthlyMenu);
router.get("/today", foodMenuController.getTodayMenu);
router.post("/update", foodMenuController.updateDailyMenu);
router.post("/bulk-update", foodMenuController.bulkUpdateMenu);

export default router;
