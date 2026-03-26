import { Request, Response } from "express";
import { Notification, Operator } from "../models";

// Kullanıcının okunmamış bildirimlerini getir
export const getMyNotifications = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user.id_dec;

        const notifications = await Notification.findAll({
            where: { user_id: userId },
            order: [["created_at", "DESC"]],
            limit: 20
        });

        const unreadCount = await Notification.count({
            where: { user_id: userId, is_read: false }
        });

        return res.status(200).json({
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error("GetNotifications Error:", error);
        return res.status(500).json({ message: "Bildirimler alınırken bir hata oluştu." });
    }
};

// Bildirimi okundu olarak işaretle
export const markAsRead = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id_dec;

        const notification = await Notification.findOne({
            where: { id, user_id: userId }
        });

        if (!notification) {
            return res.status(404).json({ message: "Bildirim bulunamadı." });
        }

        await notification.update({ is_read: true });

        return res.status(200).json({ message: "Bildirim okundu işaretlendi." });
    } catch (error) {
        console.error("MarkAsRead Error:", error);
        return res.status(500).json({ message: "İşlem sırasında bir hata oluştu." });
    }
};

// Tümünü okundu işaretle
export const markAllAsRead = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user.id_dec;

        await Notification.update(
            { is_read: true },
            { where: { user_id: userId, is_read: false } }
        );

        return res.status(200).json({ message: "Tüm bildirimler okundu işaretlendi." });
    } catch (error) {
        console.error("MarkAllAsRead Error:", error);
        return res.status(500).json({ message: "İşlem sırasında bir hata oluştu." });
    }
};
