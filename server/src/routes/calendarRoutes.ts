import { Router } from "express";
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from "../controllers/calendarController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Panel ve uygulamadaki herkesin takvimi okuyabilmesi için GET rotası açık bırakılabilir veya requireAuth eklenebilir. 
// Genel bir yapı kurduğumuz için ve dashboard'da göstereceğimizden public veya requireAuth yapabiliriz. Biz şimdilik Login Olanlar okuyabilsin diyoruz.
router.get("/", requireAuth, getCalendarEvents);

// Korumalı Rotalar - Sadece Admin yetkisi olanlar ekleme ve silme yapabilir. (Şimdilik auth kontrolü yetiyor, admin kontrolü middleware eklenebilir).
router.post("/", requireAuth, createCalendarEvent);
router.delete("/:id", requireAuth, deleteCalendarEvent);

export default router;
