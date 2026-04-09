import { Request, Response } from "express";
import { CompanyCalendar } from "../models";

// Tüm takvim etkinliklerini getir (Yıllık Görünüm İçin)
export const getCalendarEvents = async (req: Request, res: Response): Promise<any> => {
    try {
        const events = await CompanyCalendar.findAll({
            order: [['event_date', 'ASC']]
        });
        return res.status(200).json({ data: events });
    } catch (error) {
        console.error("Takvim Getirme Hatası:", error);
        return res.status(500).json({ message: "Takvim etkinlikleri alınırken bir hata oluştu." });
    }
};

// Yeni bir takvim etkinliği ekle (Sadece Admin yetkilidir) - TOPLU EKLEME (Aralık) DESTEKLİ
export const createCalendarEvent = async (req: Request, res: Response): Promise<any> => {
    try {
        const { start_date, end_date, event_type, title, description, is_half_day, color_code } = req.body;

        if (!start_date || !end_date || !event_type || !title) {
            return res.status(400).json({ message: "Başlangıç tarihi, bitiş tarihi, tür ve başlık alanları zorunludur." });
        }

        const current = new Date(start_date);
        const end = new Date(end_date);
        
        // Başlangıç tarihi bitişten büyük olamaz
        if (current > end) {
            return res.status(400).json({ message: "Başlangıç tarihi, bitiş tarihinden sonra olamaz." });
        }

        const eventsToCreate = [];
        let skippedCount = 0;

        // start_date'den end_date'e kadar dön
        while (current <= end) {
            // Tarihi YYYY-MM-DD formatında al (yerel saate göre güvenli olması için)
            const dateString = current.toISOString().split('T')[0];

            // Seçili tarih sistemde var mı?
            const existing = await CompanyCalendar.findOne({ where: { event_date: dateString } });
            
            if (existing) {
                skippedCount++;
            } else {
                eventsToCreate.push({
                    event_date: dateString,
                    event_type,
                    title,
                    description,
                    is_half_day: is_half_day || false,
                    color_code
                });
            }

            // Günü bir arttır
            current.setDate(current.getDate() + 1);
        }

        if (eventsToCreate.length === 0) {
            return res.status(400).json({ message: "Seçtiğiniz aralıktaki tüm günler zaten takvime eklenmiş." });
        }

        await CompanyCalendar.bulkCreate(eventsToCreate);

        return res.status(201).json({ 
            message: `${eventsToCreate.length} gün başarıyla takvime eklendi. ${skippedCount > 0 ? `(${skippedCount} gün zaten var olduğu için atlandı)` : ''}` 
        });
    } catch (error) {
        console.error("Takvim Ekleme Hatası:", error);
        return res.status(500).json({ message: "Etkinlik oluşturulurken bir hata oluştu." });
    }
};

// Takvim etkinliğini sil (Sadece Admin yetkilidir)
export const deleteCalendarEvent = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        const event = await CompanyCalendar.findByPk(id as string);
        if (!event) {
            return res.status(404).json({ message: "Etkinlik bulunamadı." });
        }

        await event.destroy();

        return res.status(200).json({ message: "Etkinlik başarıyla silindi." });
    } catch (error) {
        console.error("Takvim Silme Hatası:", error);
        return res.status(500).json({ message: "Etkinlik silinirken bir hata oluştu." });
    }
};
