import { Request, Response } from "express";
import { Operator, Role, Permission } from "../models";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SECRET_KEY || "super_secret_jwt_key_degistir";

// 30 Gün boyunca sisteme girişi hatırlamak için süreleri ayarlıyoruz
const TOKEN_EXPIRATION = "30d";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 Gün (Milisaniye)

export const standardLogin = async (req: Request, res: Response): Promise<any> => {
    try {
        const { username } = req.body; 

        if (!username) {
            return res.status(400).json({ message: "Kullanıcı ID numarası gereklidir." });
        }

        const user: any = await Operator.findOne({
            where: { id_dec: username },
            include: [
                {
                    model: Role,
                    include: [Permission]
                }
            ]
        });

        if (!user) {
            return res.status(401).json({ message: "Sistemde bu ID ile kayıtlı personel bulunamadı." });
        }

        // Şifre kontrolü geçici olarak devre dışı (Sadece ID ile giriş)
        // const isValidPassword = await bcrypt.compare(password, user.op_password);
        // if (!isValidPassword) ...

        // Kullanıcı geçerli. Token üret
        const token = jwt.sign(
            {
                id_dec: user.id_dec,
                name: user.name,
                surname: user.surname,
                role_id: user.role_id
            },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRATION }
        );

        // Kullanıcının yetkilerini frontend'in anlayacağı basit string formatına (Örn: "leave.view") dönüştür
        const permissionsList = user.Role?.Permissions?.map((p: any) => p.code) || [];

        // Token'ı tarayıcıya güvenli (XSS ataklarından korunan) HttpOnly cookie olarak ver
        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // Prod'da sadece HTTPS
            sameSite: "lax", // CSRF koruması
            maxAge: COOKIE_MAX_AGE,
        });

        return res.status(200).json({
            message: "Giriş başarılı.",
            user: {
                id_dec: user.id_dec,
                name: user.name,
                surname: user.surname,
                role: user.Role?.name,
                permissions: permissionsList,
                leave_balance: user.leave_balance,
                photo_url: user.photo_url
            }
        });
    } catch (error) {
        console.error("Login Hatası:", error);
        return res.status(500).json({ message: "Sunucuda bir hata oluştu." });
    }
};

// Frontend her F5 attığında (yenilendiğinde) kimin bağlı olduğunu bu API ile soracak
export const checkAuth = async (req: Request, res: Response): Promise<any> => {
    try {
        const token = req.cookies.auth_token;

        if (!token) {
            return res.status(401).json({ authenticated: false, message: "Oturum bulunamadı." });
        }

        // Token'ı doğrula
        const decoded: any = jwt.verify(token, JWT_SECRET);

        // Doğrulanan kişinin eksiksiz güncel verisini tekrar çek
        const user: any = await Operator.findOne({
            where: { id_dec: decoded.id_dec },
            include: [
                {
                    model: Role,
                    include: [Permission]
                }
            ]
        });

        if (!user) {
            return res.status(401).json({ authenticated: false, message: "Geçersiz kullanıcı oturumu." });
        }

        const permissionsList = user.Role?.Permissions?.map((p: any) => p.code) || [];

        return res.status(200).json({
            authenticated: true,
            user: {
                id_dec: user.id_dec,
                name: user.name,
                surname: user.surname,
                role: user.Role?.name,
                permissions: permissionsList,
                leave_balance: user.leave_balance,
                photo_url: user.photo_url
            }
        });
    } catch (error) {
        // Token süresi dolmuş veya hatalı ise
        return res.status(401).json({ authenticated: false, message: "Oturum süresi dolmuş veya geçersiz." });
    }
};

// Çıkış yap (Cookie'yi sil)
export const logout = (req: Request, res: Response): any => {
    res.clearCookie("auth_token", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    });
    return res.status(200).json({ message: "Başarıyla çıkış yapıldı." });
};
