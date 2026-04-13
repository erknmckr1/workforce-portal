import { Request, Response } from "express";
import { Operator, PasswordResetRequest } from "../models";
import bcrypt from "bcryptjs";

// Kullanıcı şifre sıfırlama talebi gönderir (Login ekranından)
export const requestPasswordReset = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ message: "Kullanıcı ID (TC/Sicil) gereklidir." });
        }

        const user = await Operator.findByPk(user_id);
        if (!user) {
            return res.status(404).json({ message: "Sistemde böyle bir personel bulunamadı." });
        }

        // Zaten bekleyen bir talebi var mı kontrol et
        const existingRequest = await PasswordResetRequest.findOne({
            where: { user_id, status: "PENDING" }
        });

        if (existingRequest) {
            return res.status(400).json({ message: "Zaten bekleyen bir şifre sıfırlama talebiniz mevcut. Lütfen İK ile iletişime geçin." });
        }

        await PasswordResetRequest.create({
            user_id,
            status: "PENDING"
        });

        return res.status(201).json({ message: "Şifre sıfırlama talebiniz İK birimine iletildi." });
    } catch (error) {
        console.error("RequestPasswordReset Error:", error);
        return res.status(500).json({ message: "Talep oluşturulurken bir hata oluştu." });
    }
};

// Bekleyen talepleri getir (Yetkili kullanıcılar için)
export const getResetRequests = async (req: Request, res: Response): Promise<Response> => {
    try {
        const requests = await PasswordResetRequest.findAll({
            where: { status: "PENDING" },
            include: [{
                model: Operator,
                as: "User",
                attributes: ["name", "surname", "id_dec"]
            }],
            order: [["created_at", "DESC"]]
        });

        return res.status(200).json(requests);
    } catch (error) {
        console.error("GetResetRequests Error:", error);
        return res.status(500).json({ message: "Talepler listelenirken bir hata oluştu." });
    }
};

interface AuthRequest extends Request {
    user?: {
        id_dec: string;
        role_id: number;
    };
}

// Talebi onayla veya reddet
export const handleResetRequest = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { action, temporary_password } = req.body; // action: 'APPROVE' | 'REJECT'
        const authReq = req as AuthRequest;
        const handler_id = authReq.user?.id_dec;

        const resetRequest = await PasswordResetRequest.findByPk(Number(id));
        if (!resetRequest) {
            return res.status(404).json({ message: "Talep bulunamadı." });
        }

        if (resetRequest.status !== "PENDING") {
            return res.status(400).json({ message: "Bu talep zaten sonuçlandırılmış." });
        }

        if (action === "REJECT") {
            await resetRequest.update({
                status: "REJECTED",
                handled_by: handler_id
            });
            return res.status(200).json({ message: "Talep reddedildi." });
        }

        if (action === "APPROVE") {
            if (!temporary_password) {
                return res.status(400).json({ message: "Geçici şifre belirlenmelidir." });
            }

            // 1. Şifreyi hash'le ve kullanıcıyı güncelle
            const hashedPassword = await bcrypt.hash(temporary_password, 10);
            await Operator.update(
                { op_password: hashedPassword },
                { where: { id_dec: resetRequest.user_id } }
            );

            // 2. Talebi kapat
            await resetRequest.update({
                status: "COMPLETED",
                handled_by: handler_id,
                temporary_password: temporary_password // Admin'in ekranında göstermek gerekirse kayıtlı dursun (veya opsiyonel)
            });

            return res.status(200).json({ 
                message: "Şifre başarıyla sıfırlandı.", 
                temp_password: temporary_password 
            });
        }

        return res.status(400).json({ message: "Geçersiz işlem." });
    } catch (error) {
        console.error("HandleResetRequest Error:", error);
        return res.status(500).json({ message: "İşlem yapılırken bir hata oluştu." });
    }
};
