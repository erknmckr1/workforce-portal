import { Router } from "express";
import { 
    getAllPersonnel, 
    createPersonnel, 
    updatePersonnel, 
    deletePersonnel,
    getPersonnelLookups
} from "../controllers/personnelController";

const router = Router();

// Yardımcı verileri (roles, sections vs) getir
router.get("/lookups", getPersonnelLookups);

// Tüm personelleri listele
router.get("/", getAllPersonnel);

// Yeni personel kaydet
router.post("/", createPersonnel);

// Personel bilgilerini güncelle
router.put("/:id_dec", updatePersonnel);

// Personel sil (Soft Delete)
router.delete("/:id_dec", deletePersonnel);

export default router;
