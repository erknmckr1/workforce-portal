import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { ITRequest, ITRequestMessage, Operator, Department } from "../models";

// Helper function to save file attachment to Desktop/ITDestekFotograflari
const saveAttachment = (file: Express.Multer.File): string | null => {
    try {
        const storagePath = process.env.IT_ATTACHMENT_STORAGE_PATH ||
            path.join(process.env.USERPROFILE || "C:", "Desktop", "ITDestekFotograflari");
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }

        const ext = path.extname(file.originalname) || ".png";
        const fileName = `attach_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}${ext}`;
        const filePath = path.join(storagePath, fileName);
        fs.writeFileSync(filePath, file.buffer);
        return fileName;
    } catch (err) {
        console.error("Attachment kaydetme hatası:", err);
        return null;
    }
};

// Helper function to check if user has IT / Admin permissions
const isITUser = (user: any): boolean => {
    if (!user) return false;
    if (Number(user.role_id) === 7) return true; // Admin is IT by default
    if (Number(user.role_id) === 10) return true; // Bilgi İşlem role

    if (user.Department && user.Department.name) {
        const deptName = user.Department.name.toLowerCase().replace(/ı/g, 'i').replace(/ş/g, 's').replace(/\s+/g, '');
        if (deptName.includes("bilgiislem") || deptName.includes("bilgislem")) {
            return true;
        }
    }
    return false;
};

// 1. Yeni IT Talebi Oluştur (İlk mesaj ile birlikte)
export const createRequest = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { subject, message } = req.body;
        const operator_id = req.user?.id_dec;

        if (!subject || !operator_id || (!message && !req.file)) {
            return res.status(400).json({ message: "Konu seçimi ve açıklama mesajı/dosya zorunludur." });
        }

        let attachment_url: string | null = null;
        if (req.file) {
            attachment_url = saveAttachment(req.file);
        }

        // 1. Talebi oluştur
        const request = await ITRequest.create({
            operator_id,
            subject,
            status: "Beklemede"
        });

        // 2. İlk mesajı chat loguna ekle
        await ITRequestMessage.create({
            request_id: request.id,
            sender_id: operator_id,
            message: message ? message.trim() : "",
            attachment_url
        });

        return res.status(201).json({
            message: "Talep başarıyla oluşturuldu.",
            data: request
        });
    } catch (error) {
        console.error("CreateRequest Hatası:", error);
        return res.status(500).json({ message: "Talep oluşturulurken sunucu hatası oluştu." });
    }
};

// 2. Talepleri Listele (IT ekibi hepsini, kullanıcı sadece kendisininkini görür)
export const getRequests = async (req: Request, res: Response): Promise<Response> => {
    try {
        const operator_id = req.user?.id_dec;
        if (!operator_id) {
            return res.status(401).json({ message: "Oturum bilgisi eksik." });
        }

        // Giriş yapan kullanıcının yetkisini birimine bakarak doğrula
        const user = await Operator.findOne({
            where: { id_dec: operator_id },
            include: [{ model: Department }]
        });

        const isIT = isITUser(user);

        let requests;
        if (isIT) {
            // Bilgi işlem personeli tüm talepleri görür (talep sahibinin departmanıyla birlikte)
            requests = await ITRequest.findAll({
                include: [
                    {
                        model: Operator,
                        as: "Creator",
                        attributes: ["name", "surname", "email"],
                        include: [{ model: Department, attributes: ["name"] }]
                    },
                    {
                        model: Operator,
                        as: "Assignee",
                        attributes: ["name", "surname"]
                    }
                ],
                order: [["updated_at", "DESC"]]
            });
        } else {
            // Normal personel sadece kendi oluşturduğu talepleri görür
            requests = await ITRequest.findAll({
                where: { operator_id },
                include: [
                    {
                        model: Operator,
                        as: "Creator",
                        attributes: ["name", "surname", "email"],
                        include: [{ model: Department, attributes: ["name"] }]
                    },
                    {
                        model: Operator,
                        as: "Assignee",
                        attributes: ["name", "surname"]
                    }
                ],
                order: [["updated_at", "DESC"]]
            });
        }

        return res.status(200).json({ requests, isIT });
    } catch (error) {
        console.error("GetRequests Hatası:", error);
        return res.status(500).json({ message: "Talepler getirilirken sunucu hatası oluştu." });
    }
};

// 3. Talep Mesaj Geçmişini Çek
export const getRequestMessages = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const operator_id = req.user?.id_dec;

        if (!operator_id) {
            return res.status(401).json({ message: "Oturum bilgisi eksik." });
        }

        const request = await ITRequest.findByPk(Number(id));
        if (!request) {
            return res.status(404).json({ message: "Talep bulunamadı." });
        }

        // Yetki Kontrolü: Bu talep kullanıcının kendisine mi ait yoksa kendisi IT elemanı mı?
        const user = await Operator.findOne({
            where: { id_dec: operator_id },
            include: [{ model: Department }]
        });

        const isIT = isITUser(user);

        if (!isIT && request.operator_id !== operator_id) {
            return res.status(403).json({ message: "Bu talebin yazışma geçmişini görme yetkiniz yok." });
        }

        const messages = await ITRequestMessage.findAll({
            where: { request_id: id },
            include: [
                {
                    model: Operator,
                    as: "Sender",
                    attributes: ["name", "surname", "role_id"]
                }
            ],
            order: [["created_at", "ASC"]]
        });

        return res.status(200).json({ messages });
    } catch (error) {
        console.error("GetRequestMessages Hatası:", error);
        return res.status(500).json({ message: "Mesaj geçmişi getirilirken hata oluştu." });
    }
};

// 4. Talebe Yeni Mesaj Gönder (Chatbox içi)
export const sendMessage = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const operator_id = req.user?.id_dec;

        if ((!message || !message.trim()) && !req.file) {
            return res.status(400).json({ message: "Mesaj veya dosya içeriği boş olamaz." });
        }

        const request = await ITRequest.findByPk(Number(id));
        if (!request) {
            return res.status(404).json({ message: "Talep bulunamadı." });
        }

        // Yetki Kontrolü
        const user = await Operator.findOne({
            where: { id_dec: operator_id },
            include: [{ model: Department }]
        });

        const isIT = isITUser(user);

        if (!isIT && request.operator_id !== operator_id) {
            return res.status(403).json({ message: "Bu talebe mesaj gönderme yetkiniz yok." });
        }

        let attachment_url: string | null = null;
        if (req.file) {
            attachment_url = saveAttachment(req.file);
        }

        // 1. Mesajı kaydet
        const newMessage = await ITRequestMessage.create({
            request_id: Number(id),
            sender_id: operator_id,
            message: message ? message.trim() : "",
            attachment_url
        });

        // 2. Talebin güncellenme tarihini güncelle ve eğer mesajı gönderen IT ise ve üstlenilmediyse ata
        const updatePayload: any = { updated_at: new Date() };
        if (isIT && !request.assigned_to) {
            updatePayload.assigned_to = operator_id;
        }
        await request.update(updatePayload);

        // Gönderen detaylarını ekleyip dönelim
        const messageWithSender = await ITRequestMessage.findByPk(newMessage.id, {
            include: [
                {
                    model: Operator,
                    as: "Sender",
                    attributes: ["name", "surname", "role_id"]
                }
            ]
        });

        return res.status(201).json({ message: messageWithSender });
    } catch (error) {
        console.error("SendMessage Hatası:", error);
        return res.status(500).json({ message: "Mesaj gönderilirken sunucu hatası oluştu." });
    }
};

// 5. Talep Durumunu Güncelle (Sadece IT ve Admin)
export const updateRequestStatus = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const operator_id = req.user?.id_dec;

        if (!status) {
            return res.status(400).json({ message: "Durum belirtilmesi zorunludur." });
        }

        // Yetki kontrolü (Sadece IT ve Admin güncelleyebilir)
        const user = await Operator.findOne({
            where: { id_dec: operator_id },
            include: [{ model: Department }]
        });

        if (!isITUser(user)) {
            return res.status(403).json({ message: "Talep durumunu güncelleme yetkiniz yok." });
        }

        const request = await ITRequest.findByPk(Number(id));
        if (!request) {
            return res.status(404).json({ message: "Talep bulunamadı." });
        }

        // Eğer talep zaten Çözüldü veya İptal durumundaysa durumun tekrar değiştirilmesini engelle
        if (request.status === "Çözüldü" || request.status === "İptal") {
            return res.status(400).json({ message: "Kapatılmış veya iptal edilmiş taleplerin durumu değiştirilemez." });
        }

        // Durumu güncelle ve eğer talep üstlenilmediyse otomatik olarak işlemi yapan IT personeline ata
        const updatePayload: any = {
            status,
            assigned_to: request.assigned_to || operator_id,
            updated_at: new Date()
        };

        if (status === "Çözüldü" || status === "İptal") {
            updatePayload.resolved_at = new Date();
        }

        await request.update(updatePayload);

        // Sohbet geçmişine sistem mesajı ekle
        await ITRequestMessage.create({
            request_id: request.id,
            sender_id: "system", // Sistem mesajı olarak işaretlensin
            message: `Sistem: Talep durumu '${status}' olarak güncellendi.`
        });

        return res.status(200).json({
            message: "Talep durumu güncellendi.",
            status
        });
    } catch (error) {
        console.error("UpdateRequestStatus Hatası:", error);
        return res.status(500).json({ message: "Durum güncellenirken sunucu hatası oluştu." });
    }
};
