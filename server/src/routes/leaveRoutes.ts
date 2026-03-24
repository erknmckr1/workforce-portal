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
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// ZIRH #1 : Buraya API üzerinden gelen herkesin token'ı denetlenir. 
// "Giriş yapmamış" hiç kimse aşağıdaki metodlara ulaşamaz!
router.use(requireAuth);
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

// İzin talebini iptal et (Sahibi tarafından)
router.put("/:id/cancel", cancelLeave);

// İzin talebini güncelle (Düzenle)
router.put("/:id", updateLeave);

// Güvenlik Rotaları
router.put("/:id/confirm-exit", confirmExit);

export default router;
