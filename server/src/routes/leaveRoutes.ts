import { Router } from "express";
import { 
    getLeaves, 
    createLeave, 
    getLeaveLookups,
    approveLeave,
    rejectLeave
} from "../controllers/leaveController";

const router = Router();

// Yardımcı verileri (reasons, statuses, duration types) getir
router.get("/lookups", getLeaveLookups);

// Tüm izinleri listele (Filtreleme desteğiyle)
router.get("/", getLeaves);

// Yeni izin talebi oluştur
router.post("/", createLeave);

// İzin talebini onayla
router.put("/:id/approve", approveLeave);

// İzin talebini reddet
router.put("/:id/reject", rejectLeave);

export default router;
