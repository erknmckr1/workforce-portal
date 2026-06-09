import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const KIOSK_SECRET = process.env.KIOSK_SECRET_KEY;

export const requireKioskOrAuth = (req: Request, res: Response, next: NextFunction): any => {
    const kioskKey = req.headers["x-kiosk-key"];
    const token = req.cookies.auth_token; // Doğru cookie ismi

    let hasValidToken = false;

    // 1. Senaryo: Normal JWT session var mı? (Admin/İK vb. için öncelikli)
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.SECRET_KEY || "super_secret_jwt_key_degistir");
            (req as any).user = decoded; // Kullanıcı bilgisini req'e ekle
            hasValidToken = true;
        } catch (err) {
            // Token geçersizse sessizce geç, Kiosk Key'e bakacak
        }
    }

    if (hasValidToken) {
        return next();
    }

    // 2. Senaryo: Kiosk anahtarı doğru mu?
    if (kioskKey && kioskKey === KIOSK_SECRET) {
        return next();
    }

    // İkisi de yoksa blokla
    return res.status(401).json({ message: "Bu işlem için yetkiniz bulunmamaktadır." });
};
