import { Router } from "express";
import {
  getAllContacts,
  getActiveContacts,
  createContact,
  updateContact,
  setDefaultContact,
  deleteContact,
  getSuggestions,
} from "../controllers/visitorContactController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Ziyaretçi formları için aktif kişiler (Public / Güvenlik - auth gerektirmez)
router.get("/active", getActiveContacts);

// Ayarlar ekranında personel & departman önerileri
router.get("/suggestions", requireAuth, getSuggestions);

// Tüm tanımlı kişiler (Ayarlar ekranı)
router.get("/", requireAuth, getAllContacts);

// Yeni kişi ekleme
router.post("/", requireAuth, createContact);

// Kişi güncelleme
router.put("/:id", requireAuth, updateContact);

// Tek tıkla departman varsayılanı yapma
router.patch("/:id/set-default", requireAuth, setDefaultContact);

// Kişi silme
router.delete("/:id", requireAuth, deleteContact);

export default router;
