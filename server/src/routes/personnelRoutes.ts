import { Router } from "express";
import { 
    getAllPersonnel, 
    createPersonnel, 
    updatePersonnel, 
    deletePersonnel,
    getPersonnelLookups,
    updateSectionManager,
    updateDepartmentSupervisor,
    syncAllApprovals
} from "../controllers/personnelController";

const router = Router();

// Yardımcı verileri (roles, sections vs) getir
router.get("/lookups", getPersonnelLookups);

// Tüm personelleri listele
router.get("/", getAllPersonnel);

// Yeni personel kaydet
router.post("/", createPersonnel);

// Hiyerarşi (Approvals) işlemleri
router.post("/sync-approvals", syncAllApprovals);
router.put("/section-manager/:id", updateSectionManager);
router.put("/department-supervisor/:id", updateDepartmentSupervisor);

// Personel bilgilerini güncelle
router.put("/:id_dec", updatePersonnel);

// Personel sil (Soft Delete)
router.delete("/:id_dec", deletePersonnel);

export default router;
