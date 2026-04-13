import { Router } from "express";
import { standardLogin, checkAuth, logout } from "../controllers/authController";
import { requestPasswordReset, getResetRequests, handleResetRequest } from "../controllers/passwordResetController";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

// Standard login (id + Şifre)
router.post("/login", standardLogin);

// Token doğrulama
router.get("/check", checkAuth);

// Çıkış yapma
router.post("/logout", logout);

// --- Şifre Sıfırlama ---
// 1. Personel talep gönderir (Public)
router.post("/request-reset", requestPasswordReset);

// 2. İK talepleri listeler (Auth Gerekli)
router.get("/reset-requests", requireAuth, getResetRequests);

// 3. İK talebi onaylar/sıfırlar (Auth Gerekli)
router.post("/handle-reset/:id", requireAuth, handleResetRequest);

export default router;
