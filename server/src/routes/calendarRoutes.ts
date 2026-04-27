import { Router } from "express";
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from "../controllers/calendarController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Takvimi herkes (giriş yapmayanlar dahil) ana sayfada görebilsin diye GET rotası herkese açık.
router.get("/", getCalendarEvents);

// Korumalı Rotalar - Sadece Login olanlar/Adminler ekleme ve silme yapabilir.
router.post("/", requireAuth, createCalendarEvent);
router.delete("/:id", requireAuth, deleteCalendarEvent);

export default router;
