import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SECRET_KEY || "super_secret_jwt_key_degistir";

// Express Request nesnesine "user" objesini tanımlıyoruz
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): any => {
    const token = req.cookies.auth_token;
    
    if (!token) {
        return res.status(401).json({ message: "Erişim reddedildi. Geçerli bir oturumunuz yok." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id_dec, name, surname, role_id } bilgileri burada var
        next();
    } catch {
        return res.status(401).json({ message: "Oturum süresi dolmuş veya geçersiz bir yetki." });
    }
};


export const requireRoles = (allowedRoles: number[]) => {
    return (req: Request, res: Response, next: NextFunction): any => {
        // req.user requireAuth sayesinde zaten var olmalı
        if (!req.user || !allowedRoles.includes(req.user.role_id)) {
             return res.status(403).json({ message: "Backend Reddi: Bu API işlemine erişmek için yetki seviyeniz yetersiz." });
        }
        next();
    }
};
