import { Request, Response } from "express";
import { Op } from "sequelize";
import { CompanySurvey } from "../models";

// Admin / Ayarlar: Tüm anketleri listele
export const getAllSurveys = async (req: Request, res: Response): Promise<Response> => {
  try {
    const surveys = await CompanySurvey.findAll({
      order: [
        ["order_index", "ASC"],
        ["created_at", "DESC"],
      ],
    });
    return res.status(200).json({ success: true, count: surveys.length, data: surveys });
  } catch (error) {
    console.error("[SurveyController] getAllSurveys error:", error);
    return res.status(500).json({ success: false, message: "Anketler alınamadı." });
  }
};

// MES / Kiosk / Portal: Şu an aktif ve süresi geçerli anketleri getir
export const getActiveSurveys = async (req: Request, res: Response): Promise<Response> => {
  try {
    const platform = req.query.platform ? String(req.query.platform).toUpperCase() : null;
    const now = new Date();

    const whereCondition: any = {
      is_active: true,
      [Op.and]: [
        {
          [Op.or]: [{ start_date: null }, { start_date: { [Op.lte]: now } }],
        },
        {
          [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: now } }],
        },
      ],
    };

    if (platform) {
      whereCondition.target_platforms = { [Op.like]: `%${platform}%` };
    }

    const surveys = await CompanySurvey.findAll({
      where: whereCondition,
      order: [["order_index", "ASC"], ["created_at", "ASC"]],
    });

    return res.status(200).json({ success: true, count: surveys.length, data: surveys });
  } catch (error) {
    console.error("[SurveyController] getActiveSurveys error:", error);
    return res.status(500).json({ success: false, message: "Aktif anketler alınamadı." });
  }
};

// Yeni anket oluştur
export const createSurvey = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      title,
      description,
      form_url,
      target_platforms,
      is_active = true,
      start_date,
      end_date,
      order_index = 0,
    } = req.body;

    if (!title || !form_url) {
      return res.status(400).json({ success: false, message: "Anket başlığı ve form bağlantısı zorunludur." });
    }

    const createdBy = req.user?.name ? `${req.user.name} ${req.user.surname || ""}`.trim() : null;

    const newSurvey = await CompanySurvey.create({
      title: title.trim(),
      description: description ? description.trim() : null,
      form_url: form_url.trim(),
      target_platforms: target_platforms || "MES,KIOSK,PORTAL",
      is_active: Boolean(is_active),
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      order_index: Number(order_index) || 0,
      created_by: createdBy,
    });

    return res.status(201).json({ success: true, message: "Anket başarıyla oluşturuldu.", data: newSurvey });
  } catch (error) {
    console.error("[SurveyController] createSurvey error:", error);
    return res.status(500).json({ success: false, message: "Anket oluşturulurken hata oluştu." });
  }
};

// Anket güncelle
export const updateSurvey = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const survey = await CompanySurvey.findByPk(Number(id));

    if (!survey) {
      return res.status(404).json({ success: false, message: "Anket bulunamadı." });
    }

    const {
      title,
      description,
      form_url,
      target_platforms,
      is_active,
      start_date,
      end_date,
      order_index,
    } = req.body;

    await survey.update({
      title: title !== undefined ? title.trim() : survey.title,
      description: description !== undefined ? (description ? description.trim() : null) : survey.description,
      form_url: form_url !== undefined ? form_url.trim() : survey.form_url,
      target_platforms: target_platforms !== undefined ? target_platforms : survey.target_platforms,
      is_active: is_active !== undefined ? Boolean(is_active) : survey.is_active,
      start_date: start_date !== undefined ? (start_date ? new Date(start_date) : null) : survey.start_date,
      end_date: end_date !== undefined ? (end_date ? new Date(end_date) : null) : survey.end_date,
      order_index: order_index !== undefined ? Number(order_index) : survey.order_index,
    });

    return res.status(200).json({ success: true, message: "Anket güncellendi.", data: survey });
  } catch (error) {
    console.error("[SurveyController] updateSurvey error:", error);
    return res.status(500).json({ success: false, message: "Anket güncellenirken hata oluştu." });
  }
};

// Hızlı aktif/pasif anahtarı
export const toggleSurveyStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const survey = await CompanySurvey.findByPk(Number(id));

    if (!survey) {
      return res.status(404).json({ success: false, message: "Anket bulunamadı." });
    }

    const nextState = !survey.is_active;
    await survey.update({ is_active: nextState });

    return res.status(200).json({
      success: true,
      message: `Anket durumu ${nextState ? "aktif" : "pasif"} olarak değiştirildi.`,
      is_active: nextState,
    });
  } catch (error) {
    console.error("[SurveyController] toggleSurveyStatus error:", error);
    return res.status(500).json({ success: false, message: "Anket durumu değiştirilemedi." });
  }
};

// Anket sil
export const deleteSurvey = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const survey = await CompanySurvey.findByPk(Number(id));

    if (!survey) {
      return res.status(404).json({ success: false, message: "Anket bulunamadı." });
    }

    await survey.destroy();
    return res.status(200).json({ success: true, message: "Anket başarıyla silindi." });
  } catch (error) {
    console.error("[SurveyController] deleteSurvey error:", error);
    return res.status(500).json({ success: false, message: "Anket silinirken hata oluştu." });
  }
};

// Tablo boşsa başlangıç için varsayılan iki anketi otomatik ekle
export const seedInitialSurveysIfEmpty = async (): Promise<void> => {
  try {
    const count = await CompanySurvey.count();
    if (count === 0) {
      await CompanySurvey.bulkCreate([
        {
          title: "2026 Yılı Çalışan Memnuniyeti Anketi",
          description: "Fabrika geneli çalışan memnuniyeti ve görüş değerlendirme formu.",
          form_url: "https://forms.cloud.microsoft/r/LRL1FeRfdJ",
          target_platforms: "MES,KIOSK,PORTAL",
          is_active: true,
          order_index: 1,
          created_by: "Sistem",
        },
        {
          title: "Yaşam Ücreti Anketi",
          description: "Yaşam maliyeti ve çalışan refahı araştırma anketi.",
          form_url: "https://forms.cloud.microsoft/r/c94pn0rePz",
          target_platforms: "MES,KIOSK,PORTAL",
          is_active: true,
          order_index: 2,
          created_by: "Sistem",
        },
      ]);
      console.log("[SurveyController] Varsayılan 2 anket başarıyla eklendi (Seeded).");
    }
  } catch (error) {
    console.warn("[SurveyController] Varsayılan anketler eklenirken hata oluştu:", error);
  }
};
