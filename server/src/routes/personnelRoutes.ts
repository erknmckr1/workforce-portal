import { Router } from "express";
import multer from "multer";
import { 
    getAllPersonnel, 
    createPersonnel, 
    updatePersonnel, 
    deletePersonnel,
    getPersonnelLookups,
    updateSectionManager,
    updateDepartmentSupervisor,
    updateDepartmentUstabasi,
    syncAllApprovals,
    syncLeaveBalances,
    syncLeaveBalancesLocal,
    createSection,
    updateSection,
    createDepartment,
    updateDepartment,
    getApprovalAuditLogs,
    getSystemAuditLogs,
    getPersonnelById
} from "../controllers/personnelController";
import { requireAuth } from "../middlewares/authMiddleware";
import { requireKioskOrAuth } from "../middlewares/kioskMiddleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Yardımcı verileri (roles, sections vs) getir (Kiosk veya Giriş Yapmış Kullanıcı)
router.get("/lookups", requireKioskOrAuth, getPersonnelLookups);

// Denetim (audit) loglarını listele (Sadece Giriş Yapmış Yetkili)
router.get("/approval-audit-logs", requireAuth, getApprovalAuditLogs);
router.get("/audit-logs", requireAuth, getSystemAuditLogs);

// Tüm personelleri listele (Kiosk veya Giriş Yapmış Kullanıcı)
router.get("/", requireKioskOrAuth, getAllPersonnel);

// Yeni personel kaydet (Sadece Giriş Yapmış Yetkili)
router.post("/", requireAuth, createPersonnel);

// Excel'den İzin Bakiyesi Senkronizasyonu (Sadece Giriş Yapmış Yetkili)
router.post("/sync-leaves", requireAuth, upload.single("file"), syncLeaveBalances);
router.post("/sync-leaves-local", requireAuth, syncLeaveBalancesLocal);

// Hiyerarşi (Approvals) işlemleri (Sadece Giriş Yapmış Yetkili)
router.post("/sync-approvals", requireAuth, syncAllApprovals);
router.put("/section-manager/:id", requireAuth, updateSectionManager);
router.put("/department-supervisor/:id", requireAuth, updateDepartmentSupervisor);
router.put("/department-ustabasi/:id", requireAuth, updateDepartmentUstabasi);

// Bölüm & Birim Ekleme / Güncelleme (Sadece Giriş Yapmış Yetkili)
router.post("/sections", requireAuth, createSection);
router.put("/sections/:id", requireAuth, updateSection);
router.post("/departments", requireAuth, createDepartment);
router.put("/departments/:id", requireAuth, updateDepartment);

// Personel bilgilerini güncelle (Sadece Giriş Yapmış Yetkili)
router.put("/:id_dec", requireAuth, updatePersonnel);

// Personel sil (Soft Delete) (Sadece Giriş Yapmış Yetkili)
router.delete("/:id_dec", requireAuth, deletePersonnel);

// Tekil personel getir (Kiosk / Barkod okutma veya Giriş Yapmış Kullanıcı)
router.get("/by-id/:id", requireKioskOrAuth, getPersonnelById);
router.get("/:id", requireKioskOrAuth, getPersonnelById);

export default router;

