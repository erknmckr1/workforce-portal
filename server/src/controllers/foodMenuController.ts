import { Request, Response } from "express";
import { FoodMenu } from "../models";
import { Op } from "sequelize";

// Aylık menüyü getir
export const getMonthlyMenu = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { year, month } = req.query;
        if (!year || !month) {
            return res.status(400).json({ message: "Yıl ve ay bilgisi gereklidir." });
        }

        const startDate = `${year}-${month}-01`;
        
        // Ayın son gününü yerel saatle hesaplayalım
        const endOfMo = new Date(parseInt(year as string), parseInt(month as string), 0);
        const offset = endOfMo.getTimezoneOffset();
        const endDate = new Date(endOfMo.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

        const menu = await FoodMenu.findAll({
            where: {
                menu_date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            order: [["menu_date", "ASC"]]
        });

        return res.status(200).json(menu);
    } catch (error) {
        console.error("GetMonthlyMenu Hatası:", error);
        return res.status(500).json({ message: "Menü verileri çekilirken hata oluştu." });
    }
};

// Günlük menü güncelle veya oluştur
export const updateDailyMenu = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { menu_date, items, note } = req.body;

        if (!menu_date || !items) {
            return res.status(400).json({ message: "Tarih ve yemek listesi gereklidir." });
        }

        const [menu, created] = await FoodMenu.findOrCreate({
            where: { menu_date },
            defaults: {
                menu_date,
                items: JSON.stringify(items),
                note
            }
        });

        if (!created) {
            await menu.update({
                items: JSON.stringify(items),
                note: note !== undefined ? note : menu.note
            });
        }

        return res.status(200).json({ message: "Menü başarıyla güncellendi.", data: menu });
    } catch (error) {
        console.error("UpdateDailyMenu Hatası:", error);
        return res.status(500).json({ message: "Güncelleme sırasında hata oluştu." });
    }
};

// Toplu menü güncelleme (Excel import için hazırlık)
export const bulkUpdateMenu = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { menuData } = req.body; // Array of { menu_date, items, note }

        if (!Array.isArray(menuData)) {
            return res.status(400).json({ message: "Geçersiz veri formatı." });
        }

        for (const day of menuData) {
            await FoodMenu.upsert({
                menu_date: day.menu_date,
                items: JSON.stringify(day.items),
                note: day.note
            });
        }

        return res.status(200).json({ message: "Toplu güncelleme başarılı." });
    } catch (error) {
        console.error("BulkUpdateMenu Hatası:", error);
        return res.status(500).json({ message: "Toplu işlem sırasında hata oluştu." });
    }
};

// Bugünün menüsünü getir (Dashboard için)
export const getTodayMenu = async (req: Request, res: Response): Promise<Response> => {
    try {
        // toISOString() yerine yerel tarihi YYYY-MM-DD formatında alalım
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const localToday = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

        const menu = await FoodMenu.findOne({
            where: { menu_date: localToday }
        });

        if (!menu) {
            return res.status(404).json({ message: "Bugün için menü bulunamadı." });
        }

        return res.status(200).json(menu);
    } catch (error) {
        console.error("GetTodayMenu Hatası:", error);
        return res.status(500).json({ message: "Hata oluştu." });
    }
};
