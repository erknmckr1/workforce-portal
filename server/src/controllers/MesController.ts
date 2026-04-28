import { Request, Response } from "express";
import { SapOrder } from "../models";

export const getSapOrder = async (req: Request, res: Response) => {
    const { orderId } = req.params;

    try {
        const order = await SapOrder.findOne({
            where: {
                ORDER_ID: orderId
            }
        });

        if (!order) {
            return res.status(404).json({ message: "Sipariş bulunamadı." });
        }

        return res.status(200).json(order);
    } catch (error: any) {
        console.error("SAP Sipariş sorgulama hatası:", error);
        return res.status(500).json({ message: "Sipariş bilgileri çekilirken bir hata oluştu." });
    }
};
