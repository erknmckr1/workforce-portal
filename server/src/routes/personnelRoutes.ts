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
    updateDepartment
} from "../controllers/personnelController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Yardımcı verileri (roles, sections vs) getir
router.get("/lookups", getPersonnelLookups);

// Tüm personelleri listele
router.get("/", getAllPersonnel);

// Yeni personel kaydet
router.post("/", createPersonnel);

// Excel'den İzin Bakiyesi Senkronizasyonu
router.post("/sync-leaves", upload.single("file"), syncLeaveBalances);
router.post("/sync-leaves-local", syncLeaveBalancesLocal);

// Hiyerarşi (Approvals) işlemleri
router.post("/sync-approvals", syncAllApprovals);
router.put("/section-manager/:id", updateSectionManager);
router.put("/department-supervisor/:id", updateDepartmentSupervisor);
router.put("/department-ustabasi/:id", updateDepartmentUstabasi);

// Bölüm & Birim Ekleme / Güncelleme
router.post("/sections", createSection);
router.put("/sections/:id", updateSection);
router.post("/departments", createDepartment);
router.put("/departments/:id", updateDepartment);

// Personel bilgilerini güncelle
router.put("/:id_dec", updatePersonnel);

// Personel sil (Soft Delete)
router.delete("/:id_dec", deletePersonnel);

export default router;
