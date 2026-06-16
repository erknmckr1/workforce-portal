import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const KIOSK_SECRET = process.env.KIOSK_SECRET_KEY;

export const requireKioskOrAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): any => {
  const kioskKey = req.headers["x-kiosk-key"];
  const isKioskContext = req.headers["x-kiosk-context"] === "true";
  const token = req.cookies.auth_token;

  if (isKioskContext && kioskKey && kioskKey === KIOSK_SECRET) {
    return next();
  }

  let hasValidToken = false;

  // Normal JWT session varsa Admin/IK gibi ekranlar icin once auth kullanilir.
  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.SECRET_KEY || "super_secret_jwt_key_degistir",
      );
      (req as any).user = decoded;
      hasValidToken = true;
    } catch {
      // Token gecersizse kiosk anahtari kontrolune dus.
    }
  }

  if (hasValidToken) {
    return next();
  }

  if (kioskKey && kioskKey === KIOSK_SECRET) {
    return next();
  }

  return res
    .status(401)
    .json({ message: "Bu işlem için yetkiniz bulunmamaktadır." });
};
