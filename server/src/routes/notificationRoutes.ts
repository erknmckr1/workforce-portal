import { Router } from "express";
import { 
    getMyNotifications, 
    markAsRead, 
    markAllAsRead 
} from "../controllers/notificationController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Tüm rotalar için oturum kontrolü şart (req.user buradan gelir)
router.use(requireAuth);

router.get("/my", getMyNotifications);
router.put("/:id/read", markAsRead);
router.put("/mark-all-read", markAllAsRead);

export default router;
