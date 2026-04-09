import { Router } from "express";
import { 
    getLeaves, 
    createLeave, 
    getLeaveLookups,
    approveLeave,
    rejectLeave,
    cancelLeave,
    updateLeave,
    confirmExit
} from "../controllers/leaveController";
import { requireKioskOrAuth } from "../middlewares/kioskMiddleware";

const router = Router();

// --- İzin İşlemleri (Kiosk Anahtarı veya Giriş Bileti Şart!) ---
router.get("/lookups", requireKioskOrAuth, getLeaveLookups);
router.get("/", requireKioskOrAuth, getLeaves);
router.post("/", requireKioskOrAuth, createLeave);

router.put("/:id/approve", requireKioskOrAuth, approveLeave);
router.put("/:id/reject", requireKioskOrAuth, rejectLeave);
router.put("/:id/cancel", requireKioskOrAuth, cancelLeave);
router.put("/:id", requireKioskOrAuth, updateLeave);
router.put("/:id/confirm-exit", requireKioskOrAuth, confirmExit);

export default router;
