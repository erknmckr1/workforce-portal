import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const KIOSK_SECRET = process.env.KIOSK_SECRET_KEY;

export const requireKioskOrAuth = (req: Request, res: Response, next: NextFunction): any => {
    const kioskKey = req.headers["x-kiosk-key"];
    const token = req.cookies.jwt;

    // 1. Senaryo: Kiosk anahtarı doğru mu?
    if (kioskKey && kioskKey === KIOSK_SECRET) {
        return next();
    }

    // 2. Senaryo: Normal JWT session var mı? (Admin/İK vb. için)
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.SECRET_KEY || "super_secret_jwt_key_degistir");
            (req as any).user = decoded; // Kullanıcı bilgisini req'e ekle
            return next();
        } catch (err) {
            // Token geçersizse ama Kiosk anahtarı da yoksa hata ver
            return res.status(401).json({ message: "Geçersiz oturum veya yetkisiz erişim." });
        }
    }

    // İkisi de yoksa blokla
    return res.status(401).json({ message: "Bu işlem için yetkiniz bulunmamaktadır." });
};
