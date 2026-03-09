import { Router } from "express";
import { standardLogin, checkAuth, logout } from "../controllers/authController";

const router = Router();

// Standard login (id + Şifre)
router.post("/login", standardLogin);

// Token doğrulama (Frontend sayfa yenilendiğinde kullanılır)
router.get("/check", checkAuth);

// Çıkış yapma
router.post("/logout", logout);

export default router;
