import { Request, Response } from "express";
import { ScrapTracking, Operator, SapOrder } from "../models";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";

export const getScrapTrackings = async (req: Request, res: Response) => {
  try {
    const {
      search,
      is_scrap,
      karat,
      scrap_location,
      scrap_reason,
      start_date,
      end_date,
      page = 1,
      limit = 100,
    } = req.query;

    const where: any = {};

    if (is_scrap !== undefined && is_scrap !== "") {
      where.is_scrap = String(is_scrap) === "true";
    }

    if (karat && karat !== "ALL") {
      where.karat = String(karat);
    }

    if (scrap_location && scrap_location !== "ALL") {
      where.scrap_location = String(scrap_location);
    }

    if (scrap_reason && scrap_reason !== "ALL") {
      where.scrap_reason = String(scrap_reason);
    }

    // Tarih aralığı filtresi
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        const startDateObj = new Date(String(start_date));
        startDateObj.setHours(0, 0, 0, 0);
        where.created_at[Op.gte] = startDateObj;
      }
      if (end_date) {
        const endDateObj = new Date(String(end_date));
        endDateObj.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = endDateObj;
      }
    }

    if (search) {
      const searchStr = String(search).trim();
      where[Op.or] = [
        { order_no: { [Op.like]: `%${searchStr}%` } },
        { description: { [Op.like]: `%${searchStr}%` } },
        { wire_code: { [Op.like]: `%${searchStr}%` } },
        { defect_note: { [Op.like]: `%${searchStr}%` } },
        { scrap_location: { [Op.like]: `%${searchStr}%` } },
        { scrap_reason: { [Op.like]: `%${searchStr}%` } },
      ];
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await ScrapTracking.findAndCountAll({
      where,
      include: [
        {
          model: Operator,
          as: "Operator",
          attributes: ["id_dec", "name", "surname"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
      limit: Number(limit),
      offset,
      distinct: true,
    });

    const totalAll = await ScrapTracking.count();
    const scrapAll = await ScrapTracking.count({ where: { is_scrap: true } });
    const pendingAll = totalAll - scrapAll;

    return res.status(200).json({
      data: rows,
      totalCount: count,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
      stats: {
        total: totalAll,
        scrapCount: scrapAll,
        pendingCount: pendingAll,
        withImage: totalAll,
      },
    });
  } catch (error) {
    console.error("getScrapTrackings Error:", error);
    return res.status(500).json({ message: "Hurda kayıtları getirilirken hata oluştu." });
  }
};

export const getScrapTrackingById = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
    const record = await ScrapTracking.findByPk(id, {
      include: [
        {
          model: Operator,
          as: "Operator",
          attributes: ["id_dec", "name", "surname"],
          required: false,
        },
      ],
    });

    if (!record) {
      return res.status(404).json({ message: "Kayıt bulunamadı." });
    }

    return res.status(200).json(record);
  } catch (error) {
    console.error("getScrapTrackingById Error:", error);
    return res.status(500).json({ message: "Kayıt detayları getirilemedi." });
  }
};

export const createScrapTracking = async (req: Request, res: Response) => {
  try {
    const {
      order_no,
      karat,
      color,
      description,
      wire_code,
      defect_note,
      is_scrap,
      scrap_location,
      scrap_reason,
      operator_id,
    } = req.body;

    if (!order_no) {
      return res.status(400).json({ message: "Sipariş Numarası zorunludur." });
    }

    let finalKarat = karat;
    let finalColor = color;
    let finalDescription = description;

    // Eğer ayar, renk veya açıklama boşsa SapOrder'dan otomatik tamamla
    if (!finalKarat || !finalColor || !finalDescription) {
      try {
        const sapOrder = await SapOrder.findOne({ where: { ORDER_ID: String(order_no).trim() } });
        if (sapOrder) {
          if (!finalKarat) finalKarat = sapOrder.CARAT;
          if (!finalColor) finalColor = sapOrder.COLOR;
          if (!finalDescription) finalDescription = sapOrder.ITEM_DESCRIPTION || sapOrder.GENERAL_DESCRIPTION;
        }
      } catch (err) {
        console.warn("SapOrder otomatik tamamlama atlandı:", err);
      }
    }

    let imageUrl: string = "/images/sample-scrap.svg";
    if (req.file) {
      imageUrl = `/uploads/scrap-images/${req.file.filename}`;
    } else if (req.body.image_url && req.body.image_url.trim() !== "") {
      imageUrl = req.body.image_url.trim();
    }

    const newRecord = await ScrapTracking.create({
      order_no: String(order_no).trim(),
      karat: finalKarat ? String(finalKarat).trim() : null,
      color: finalColor ? String(finalColor).trim() : null,
      description: finalDescription ? String(finalDescription).trim() : null,
      wire_code: wire_code ? String(wire_code).trim() : null,
      defect_note: defect_note ? String(defect_note).trim() : null,
      is_scrap: is_scrap === "true" || is_scrap === true,
      scrap_location: scrap_location ? String(scrap_location).trim() : null,
      scrap_reason: scrap_reason ? String(scrap_reason).trim() : null,
      image_url: imageUrl,
      operator_id: operator_id || (req as any).user?.id_dec || null,
    });

    return res.status(201).json(newRecord);
  } catch (error) {
    console.error("createScrapTracking Error:", error);
    return res.status(500).json({ message: "Hurda kaydı oluşturulurken hata oluştu." });
  }
};

export const updateScrapTracking = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
    const record = await ScrapTracking.findByPk(id);

    if (!record) {
      return res.status(404).json({ message: "Güncellenecek kayıt bulunamadı." });
    }

    const {
      order_no,
      karat,
      color,
      description,
      wire_code,
      defect_note,
      is_scrap,
      scrap_location,
      scrap_reason,
    } = req.body;

    let imageUrl = record.image_url;
    if (req.file) {
      // Yeni dosya yüklendiyse eskisini temizlemeye çalış (opsiyonel)
      if (record.image_url && record.image_url.startsWith("/uploads/scrap-images/")) {
        const oldFilename = record.image_url.replace("/uploads/scrap-images/", "");
        const oldPath = path.join(__dirname, "../../uploads/scrap-images", oldFilename);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      imageUrl = `/uploads/scrap-images/${req.file.filename}`;
    }

    await record.update({
      order_no: order_no !== undefined ? String(order_no).trim() : record.order_no,
      karat: karat !== undefined ? (karat ? String(karat).trim() : null) : record.karat,
      color: color !== undefined ? (color ? String(color).trim() : null) : record.color,
      description: description !== undefined ? (description ? String(description).trim() : null) : record.description,
      wire_code: wire_code !== undefined ? (wire_code ? String(wire_code).trim() : null) : record.wire_code,
      defect_note: defect_note !== undefined ? (defect_note ? String(defect_note).trim() : null) : record.defect_note,
      is_scrap: is_scrap !== undefined ? (is_scrap === "true" || is_scrap === true) : record.is_scrap,
      scrap_location: scrap_location !== undefined ? (scrap_location ? String(scrap_location).trim() : null) : record.scrap_location,
      scrap_reason: scrap_reason !== undefined ? (scrap_reason ? String(scrap_reason).trim() : null) : record.scrap_reason,
      image_url: imageUrl,
    });

    return res.status(200).json(record);
  } catch (error) {
    console.error("updateScrapTracking Error:", error);
    return res.status(500).json({ message: "Hurda kaydı güncellenirken hata oluştu." });
  }
};

export const deleteScrapTracking = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
    const record = await ScrapTracking.findByPk(id);

    if (!record) {
      return res.status(404).json({ message: "Kayıt bulunamadı." });
    }

    if (record.image_url && record.image_url.startsWith("/uploads/scrap-images/")) {
      const filename = record.image_url.replace("/uploads/scrap-images/", "");
      const filePath = path.join(__dirname, "../../uploads/scrap-images", filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await record.destroy();
    return res.status(200).json({ message: "Kayıt başarıyla silindi." });
  } catch (error) {
    console.error("deleteScrapTracking Error:", error);
    return res.status(500).json({ message: "Kayıt silinirken hata oluştu." });
  }
};

export const getSapOrderInfo = async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const cleanNo = String(orderNo).trim();

    const sapOrder = await SapOrder.findOne({
      where: { ORDER_ID: cleanNo },
    });

    if (!sapOrder) {
      return res.status(404).json({ message: "Sipariş bulunamadı." });
    }

    return res.status(200).json({
      order_id: sapOrder.ORDER_ID,
      karat: sapOrder.CARAT,
      color: sapOrder.COLOR,
      description: sapOrder.ITEM_DESCRIPTION || sapOrder.GENERAL_DESCRIPTION,
      material_no: sapOrder.MATERIAL_NO,
      production_amount: sapOrder.PRODUCTION_AMOUNT,
    });
  } catch (error) {
    console.error("getSapOrderInfo Error:", error);
    return res.status(500).json({ message: "Sipariş bilgisi çekilemedi." });
  }
};
