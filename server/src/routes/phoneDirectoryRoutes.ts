import { Router } from "express";
import {
  getPhoneDirectory,
  createPhoneEntry,
  updatePhoneEntry,
  deletePhoneEntry,
} from "../controllers/phoneDirectoryController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Telefon rehberini okuma serbesttir
router.get("/", getPhoneDirectory);

// Ekleme, düzenleme ve silme işlemleri oturum zorunludur
router.post("/", requireAuth, createPhoneEntry);
router.put("/:id", requireAuth, updatePhoneEntry);
router.delete("/:id", requireAuth, deletePhoneEntry);

export default router;
