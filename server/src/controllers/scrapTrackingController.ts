import { Request, Response } from "express";
import { ScrapTracking, Operator, SapOrder, MesRepairReason } from "../models";
import { Op, Sequelize } from "sequelize";
import path from "path";
import fs from "fs";
import { writeAuditLog, extractAuditActor } from "../services/auditService";

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
      where.scrap_reason = { [Op.like]: `%${String(scrap_reason).trim()}%` };
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

    // Aktif kullanıcıyı (aktörü) tespit et
    const actor = await extractAuditActor(req);
    const resolvedOperatorId =
      actor.operatorId || (operator_id ? String(operator_id).trim() : null) || (req as any).user?.id_dec || null;

    let finalKarat = karat;
    let finalColor = color;
    let finalDescription = description;
    let finalWireCode = wire_code;

    // Eğer ayar, renk veya açıklama boşsa SapOrder'dan otomatik tamamla
    if (!finalKarat || !finalColor || !finalDescription || !finalWireCode) {
      try {
        const cleanNo = String(order_no).replace(/^#/, "").trim();
        const sapOrder = await SapOrder.findOne({
          where: {
            [Op.or]: [
              { ORDER_ID: cleanNo },
              { ORDER_ID: `${cleanNo} ` },
              { ORDER_ID: `${cleanNo}  ` },
            ],
          },
        });
        if (sapOrder) {
          if (!finalKarat && sapOrder.CARAT) {
            finalKarat = String(sapOrder.CARAT).replace(/[^0-9]/g, "").trim();
          }
          if (!finalColor && sapOrder.COLOR) {
            const c = String(sapOrder.COLOR).trim().toUpperCase();
            finalColor = c.startsWith("B") ? "B" : (c.startsWith("K") || c.startsWith("R")) ? "K" : "Y";
          }
          if (!finalDescription) {
            finalDescription = (
              sapOrder.ITEM_DESCRIPTION ||
              sapOrder.GENERAL_DESCRIPTION ||
              sapOrder.MATERIAL_DESCRIPTION ||
              ""
            ).trim();
          }
          if (!finalWireCode && sapOrder.MATERIAL_NO) {
            finalWireCode = sapOrder.MATERIAL_NO.trim();
          }
        }
      } catch (err) {
        console.warn("SapOrder otomatik tamamlama atlandı:", err);
      }
    }

    let imageUrl: string | null = null;
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
      wire_code: finalWireCode ? String(finalWireCode).trim() : null,
      defect_note: defect_note ? String(defect_note).trim() : null,
      is_scrap: is_scrap === "true" || is_scrap === true,
      scrap_location: scrap_location ? String(scrap_location).trim() : null,
      scrap_reason: normalizeScrapReasons(scrap_reason),
      image_url: imageUrl,
      operator_id: resolvedOperatorId,
    });

    // Merkezi Denetim Logu (SystemAuditLog) Kaydı
    const actorStr = actor.operatorId
      ? `${actor.operatorName} (${actor.operatorId})`
      : (actor.operatorName || "Sistem");

    await writeAuditLog({
      req,
      module: "SCRAP_TRACKING",
      actionType: "CREATE_SCRAP",
      description: `${actorStr}, '${newRecord.order_no}' siparişi için yeni ${
        newRecord.is_scrap ? "Hurda" : "Takip"
      } kaydı oluşturdu. (Ayar: ${newRecord.karat || "-"}, Tel: ${
        newRecord.wire_code || "-"
      }, Neden: ${newRecord.scrap_reason || "-"})`,
      details: {
        recordId: newRecord.id,
        orderNo: newRecord.order_no,
        wireCode: newRecord.wire_code,
        karat: newRecord.karat,
        color: newRecord.color,
        description: newRecord.description,
        isScrap: newRecord.is_scrap,
        scrapLocation: newRecord.scrap_location,
        scrapReason: newRecord.scrap_reason,
        defectNote: newRecord.defect_note,
        imageUrl: newRecord.image_url,
        operatorId: resolvedOperatorId,
      },
    });

    // İlişkili operatör bilgisiyle birlikte dön
    const recordWithOperator = await ScrapTracking.findByPk(newRecord.id, {
      include: [
        {
          model: Operator,
          as: "Operator",
          attributes: ["id_dec", "name", "surname"],
          required: false,
        },
      ],
    });

    return res.status(201).json(recordWithOperator || newRecord);
  } catch (error) {
    console.error("createScrapTracking Error:", error);
    return res.status(500).json({ message: "Hurda kaydı oluşturulurken hata oluştu." });
  }
};

// Görsel depolama klasörü yardımcısı
const getScrapUploadDir = () => {
  return (
    process.env.SCRAP_IMAGE_STORAGE_PATH ||
    path.join(__dirname, "../../uploads/scrap-images")
  );
};

// Birden fazla hurda nedenini temizleme ve tekilleştirme yardımcısı
export const normalizeScrapReasons = (val: any): string | null => {
  if (!val) return null;
  let arr: string[] = [];
  if (Array.isArray(val)) {
    arr = val;
  } else if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        arr = JSON.parse(trimmed);
      } catch {
        arr = trimmed.split(",");
      }
    } else {
      arr = trimmed.split(",");
    }
  }
  const cleaned = arr
    .map((s) => (typeof s === "string" ? s.trim() : String(s).trim()))
    .filter((s) => s.length > 0);
  const unique = Array.from(new Set(cleaned));
  return unique.length > 0 ? unique.join(", ") : null;
};

export const updateScrapTracking = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
    const record = await ScrapTracking.findByPk(id);

    if (!record) {
      return res.status(404).json({ message: "Güncellenecek kayıt bulunamadı." });
    }

    const actor = await extractAuditActor(req);
    const actorStr = actor.operatorId
      ? `${actor.operatorName} (${actor.operatorId})`
      : (actor.operatorName || "Sistem");

    const oldSnapshot = record.toJSON ? record.toJSON() : { ...record.get() };

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
    let imageChanged = false;

    if (req.file) {
      // Yeni dosya yüklendiyse eskisini temizlemeye çalış (opsiyonel)
      if (record.image_url && record.image_url.startsWith("/uploads/scrap-images/")) {
        const oldFilename = record.image_url.replace("/uploads/scrap-images/", "");
        const oldPath = path.join(getScrapUploadDir(), oldFilename);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.warn("Eski görsel silinemedi:", e);
          }
        }
      }
      imageUrl = `/uploads/scrap-images/${req.file.filename}`;
      imageChanged = true;
    } else if (req.body.remove_image === "true" || req.body.image_url === "") {
      if (record.image_url && record.image_url.startsWith("/uploads/scrap-images/")) {
        const oldFilename = record.image_url.replace("/uploads/scrap-images/", "");
        const oldPath = path.join(getScrapUploadDir(), oldFilename);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.warn("Eski görsel silinemedi:", e);
          }
        }
      }
      imageUrl = null;
      imageChanged = true;
    }

    const nextOrderNo = order_no !== undefined ? String(order_no).trim() : record.order_no;
    const nextKarat = karat !== undefined ? (karat ? String(karat).trim() : null) : record.karat;
    const nextColor = color !== undefined ? (color ? String(color).trim() : null) : record.color;
    const nextDescription = description !== undefined ? (description ? String(description).trim() : null) : record.description;
    const nextWireCode = wire_code !== undefined ? (wire_code ? String(wire_code).trim() : null) : record.wire_code;
    const nextDefectNote = defect_note !== undefined ? (defect_note ? String(defect_note).trim() : null) : record.defect_note;
    const nextIsScrap = is_scrap !== undefined ? (is_scrap === "true" || is_scrap === true) : record.is_scrap;
    const nextScrapLocation = scrap_location !== undefined ? (scrap_location ? String(scrap_location).trim() : null) : record.scrap_location;
    const nextScrapReason = scrap_reason !== undefined ? normalizeScrapReasons(scrap_reason) : record.scrap_reason;

    // Alan değişikliklerini (diff) ve insan tarafından okunabilir özeti oluştur
    const changes: Record<string, { old: any; new: any; label: string }> = {};
    const summaryItems: string[] = [];

    const checkDiff = (key: string, label: string, oldVal: any, newVal: any) => {
      const oStr = oldVal !== null && oldVal !== undefined ? String(oldVal).trim() : "";
      const nStr = newVal !== null && newVal !== undefined ? String(newVal).trim() : "";
      if (oStr !== nStr) {
        changes[key] = { old: oldVal, new: newVal, label };
        summaryItems.push(`${label} (${oStr || "Boş"} ➔ ${nStr || "Boş"})`);
      }
    };

    checkDiff("order_no", "Sipariş No", oldSnapshot.order_no, nextOrderNo);
    checkDiff("karat", "Ayar", oldSnapshot.karat, nextKarat);
    checkDiff("color", "Renk", oldSnapshot.color, nextColor);
    checkDiff("description", "Açıklama (Model)", oldSnapshot.description, nextDescription);
    checkDiff("wire_code", "Tel Kodu", oldSnapshot.wire_code, nextWireCode);
    checkDiff("defect_note", "Hata Notu", oldSnapshot.defect_note, nextDefectNote);
    checkDiff("scrap_location", "Hurda Yeri", oldSnapshot.scrap_location, nextScrapLocation);
    checkDiff("scrap_reason", "Hurda Nedeni", oldSnapshot.scrap_reason, nextScrapReason);

    if (oldSnapshot.is_scrap !== nextIsScrap) {
      const oldState = oldSnapshot.is_scrap ? "HURDA" : "TAKİPTE";
      const newState = nextIsScrap ? "HURDA" : "TAKİPTE";
      changes.is_scrap = { old: oldSnapshot.is_scrap, new: nextIsScrap, label: "Durum" };
      summaryItems.push(`Durum (${oldState} ➔ ${newState})`);
    }

    if (imageChanged) {
      changes.image_url = { old: oldSnapshot.image_url, new: imageUrl, label: "Görsel" };
      summaryItems.push("Görsel Yenilendi");
    }

    await record.update({
      order_no: nextOrderNo,
      karat: nextKarat,
      color: nextColor,
      description: nextDescription,
      wire_code: nextWireCode,
      defect_note: nextDefectNote,
      is_scrap: nextIsScrap,
      scrap_location: nextScrapLocation,
      scrap_reason: nextScrapReason,
      image_url: imageUrl,
    });

    // Değişiklik varsa Merkezi Denetim Logu (SystemAuditLog) Kaydı oluştur
    if (summaryItems.length > 0) {
      await writeAuditLog({
        req,
        module: "SCRAP_TRACKING",
        actionType: "UPDATE_SCRAP",
        description: `${actorStr}, '${record.order_no}' (ID: ${record.id}) hurda kaydını güncelledi. Değişenler: ${summaryItems.join(", ")}.`,
        details: {
          recordId: record.id,
          orderNo: record.order_no,
          changes,
        },
      });
    }

    // İlişkili operatör bilgisiyle birlikte dön
    const updatedRecord = await ScrapTracking.findByPk(record.id, {
      include: [
        {
          model: Operator,
          as: "Operator",
          attributes: ["id_dec", "name", "surname"],
          required: false,
        },
      ],
    });

    return res.status(200).json(updatedRecord || record);
  } catch (error) {
    console.error("updateScrapTracking Error:", error);
    return res.status(500).json({ message: "Hurda kaydı güncellenirken hata oluştu." });
  }
};

export const deleteScrapTracking = async (req: Request, res: Response) => {
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

    const actor = await extractAuditActor(req);
    const actorStr = actor.operatorId
      ? `${actor.operatorName} (${actor.operatorId})`
      : (actor.operatorName || "Sistem");

    // Silinen kaydın tam snapshot'ı (veri kaybını önlemek için)
    const deletedSnapshot = record.toJSON ? record.toJSON() : { ...record.get() };

    // Görsel dosyasını sil
    if (record.image_url && record.image_url.startsWith("/uploads/scrap-images/")) {
      const filename = record.image_url.replace("/uploads/scrap-images/", "");
      const filePath = path.join(getScrapUploadDir(), filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn("Görsel silinemedi:", e);
        }
      }
    }

    await record.destroy();

    // Merkezi Denetim Logu (SystemAuditLog) Kaydı
    await writeAuditLog({
      req,
      module: "SCRAP_TRACKING",
      actionType: "DELETE_SCRAP",
      description: `${actorStr}, '${deletedSnapshot.order_no}' (ID: ${deletedSnapshot.id}) hurda kaydını sildi. (Neden: ${deletedSnapshot.scrap_reason || "-"}, Ayar: ${deletedSnapshot.karat || "-"})`,
      details: {
        recordId: deletedSnapshot.id,
        orderNo: deletedSnapshot.order_no,
        deletedRecord: deletedSnapshot,
      },
    });

    return res.status(200).json({ message: "Kayıt başarıyla silindi." });
  } catch (error) {
    console.error("deleteScrapTracking Error:", error);
    return res.status(500).json({ message: "Kayıt silinirken hata oluştu." });
  }
};

export const getSapOrderInfo = async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const cleanNo = String(orderNo).replace(/^#/, "").trim();

    if (!cleanNo) {
      return res.status(400).json({ message: "Sipariş Numarası belirtilmedi." });
    }

    // Arama varyasyonları:
    // 1. Doğrudan cleanNo
    // 2. Trailing spaces (SQL Server CHAR alanı)
    // 3. Leading zero ile padStart (6 veya 7 hane)
    const candidates = [cleanNo];
    if (/^\d+$/.test(cleanNo)) {
      if (cleanNo.length < 6) candidates.push(cleanNo.padStart(6, "0"));
      if (cleanNo.length < 7) candidates.push(cleanNo.padStart(7, "0"));
    }

    let sapOrder: any = null;
    for (const candidate of candidates) {
      sapOrder = await SapOrder.findOne({
        where: {
          [Op.or]: [
            { ORDER_ID: candidate },
            { ORDER_ID: `${candidate} ` },
            { ORDER_ID: `${candidate}  ` },
          ],
        },
      });
      if (sapOrder) break;
    }

    if (!sapOrder) {
      return res.status(404).json({ message: "Sipariş veritabanında bulunamadı." });
    }

    // Karat temizleme (ör: "14", "14K", "14 ")
    let karatClean = sapOrder.CARAT ? String(sapOrder.CARAT).replace(/[^0-9]/g, "").trim() : "";

    // Renk eşleme (Y, K, B)
    let colorClean = "Y";
    if (sapOrder.COLOR) {
      const c = String(sapOrder.COLOR).trim().toUpperCase();
      if (c.startsWith("B")) colorClean = "B";
      else if (c.startsWith("K") || c.startsWith("R")) colorClean = "K";
      else colorClean = "Y";
    }

    const description = (
      sapOrder.ITEM_DESCRIPTION ||
      sapOrder.GENERAL_DESCRIPTION ||
      sapOrder.MATERIAL_DESCRIPTION ||
      ""
    ).trim();

    const wireCode = (sapOrder.MATERIAL_NO || "").trim();

    return res.status(200).json({
      order_id: sapOrder.ORDER_ID ? sapOrder.ORDER_ID.trim() : cleanNo,
      karat: karatClean,
      color: colorClean,
      description: description,
      wire_code: wireCode,
      material_no: wireCode,
      material_description: (sapOrder.MATERIAL_DESCRIPTION || "").trim(),
      production_amount: sapOrder.PRODUCTION_AMOUNT,
    });
  } catch (error) {
    console.error("getSapOrderInfo Error:", error);
    return res.status(500).json({ message: "Sipariş bilgisi çekilemedi." });
  }
};

export const getScrapReport = async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    const where: any = {};

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        const start = new Date(String(start_date));
        start.setHours(0, 0, 0, 0);
        where.created_at[Op.gte] = start;
      }
      if (end_date) {
        const end = new Date(String(end_date));
        end.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = end;
      }
    }

    const records = await ScrapTracking.findAll({
      where,
      attributes: [
        "id",
        "order_no",
        "karat",
        "color",
        "is_scrap",
        "scrap_location",
        "scrap_reason",
        "created_at",
      ],
      order: [["created_at", "ASC"]],
    });

    const totalCount = records.length;
    const scrapCount = records.filter((r) => r.is_scrap).length;
    const pendingCount = totalCount - scrapCount;
    const scrapRate = totalCount > 0 ? Number(((scrapCount / totalCount) * 100).toFixed(1)) : 0;

    // İstasyon dağılımı
    const locationMap: Record<string, { total: number; scrap: number; pending: number }> = {};
    // Neden dağılımı
    const reasonMap: Record<string, number> = {};
    // Ayar dağılımı
    const karatMap: Record<string, number> = {};
    // Tarihsel trend (günlük)
    const dailyMap: Record<string, { date: string; scrap: number; pending: number; total: number }> = {};

    for (const r of records) {
      const loc = r.scrap_location || "BELİRTİLMEDİ";
      if (!locationMap[loc]) locationMap[loc] = { total: 0, scrap: 0, pending: 0 };
      locationMap[loc].total++;
      if (r.is_scrap) locationMap[loc].scrap++;
      else locationMap[loc].pending++;

      if (r.scrap_reason) {
        const subReasons = r.scrap_reason
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        for (const sub of subReasons) {
          reasonMap[sub] = (reasonMap[sub] || 0) + 1;
        }
      } else {
        reasonMap["Belirtilmedi"] = (reasonMap["Belirtilmedi"] || 0) + 1;
      }

      const karat = r.karat ? `${r.karat}K` : "Belirtilmedi";
      karatMap[karat] = (karatMap[karat] || 0) + 1;

      const dayKey = new Date(r.created_at).toISOString().split("T")[0];
      if (!dailyMap[dayKey]) dailyMap[dayKey] = { date: dayKey, scrap: 0, pending: 0, total: 0 };
      dailyMap[dayKey].total++;
      if (r.is_scrap) dailyMap[dayKey].scrap++;
      else dailyMap[dayKey].pending++;
    }

    const byLocation = Object.entries(locationMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    const byReason = Object.entries(reasonMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const byKarat = Object.entries(karatMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const dailyTrend = Object.values(dailyMap);

    const topLocation = byLocation[0] ? `${byLocation[0].name} (${byLocation[0].total} kayıt)` : "-";
    const topReason = byReason[0] ? `${byReason[0].name} (${byReason[0].count} kayıt)` : "-";

    return res.status(200).json({
      summary: {
        totalCount,
        scrapCount,
        pendingCount,
        scrapRate,
        topLocation,
        topReason,
      },
      byLocation,
      byReason,
      byKarat,
      dailyTrend,
    });
  } catch (error) {
    console.error("getScrapReport Error:", error);
    return res.status(500).json({ message: "Hurda raporu verileri alınırken hata oluştu." });
  }
};

const FALLBACK_SCRAP_REASONS = [
  "BAG - MAKARA HATASI",
  "BOY HATASI",
  "BOZUK DAMGA",
  "BOZUK HALKA",
  "BOZUK KILIT",
  "BOZUK KULAKCIK",
  "BOZUK MINE",
  "BOZUK PAPYON",
  "BOZUK PUL",
  "BOZUK SILIKON",
  "BOZUK ZINCIR",
  "ÇAPAK PROBLEMI",
  "ÇIZIK ÜRÜN",
  "DAMGASIZ",
  "DÜGÜMLÜ ZINCIR",
  "EKSIK BAR",
  "EKSIK BITIS HALKASI",
  "EKSIK DESEN",
  "EKSIK HALKA",
  "EKSIK KILIT",
  "EKSIK MINE",
  "EKSIK PAPYON",
  "EKSIK PUL",
  "EKSIK TAS",
  "EKSIK TOP",
  "ERIMIS DAMGA",
  "ERIMIS PAPYON",
  "ERIMIS PUL",
  "EZIK DAMGA",
  "EZIK FERMUAR",
  "EZIK HALKA",
  "EZIK KILIT",
  "EZIK MENGEÇ",
  "EZIK PAPYON",
  "EZIK PLAKA",
  "EZIK PUL",
  "EZIK SILIKONLU TOP",
  "EZIK TOP",
  "EZIK ZINCIR",
  "FIKS ZINCIR",
  "GÖRÜNTÜ PROBLEMI",
  "ISLEM GÖRMEMIS PAPYON",
  "KAYNAKSIZ URUN",
  "KILITTE TAKILMA",
  "KIRIK PAPYON",
  "KIRIK ZINCIR",
  "KOPUK",
  "LOGOSUZ KILIT",
  "MIKNATISLANMA",
  "ORTALAMA GRAM HATASI",
  "PIM AYAR YAPILMAMIS",
  "RENK PROBLEMI",
  "SILIK DAMGA",
  "TAMAMLANMAMIS ÜRÜN",
  "TIRASSIZ ÜRÜN",
  "ÜRÜNDE ÇIZIK",
  "ÜRÜNDE MATLIK",
  "UZAMIS ZINCIR",
  "YALDIZSIZ ZINCIR",
  "YAMUK KILIT",
  "YAMUK PIM",
  "YANLIS DAMGA",
  "YANLIS HALKA",
  "YANLIS KAYNAK",
  "YANLIS KILIT",
  "YANLIS MONTAJ",
  "YANLIS ZINCIR",
  "Diğer",
];

// Distinct ile tekrar eden kayıtlar elenir. [Op.ne] SQL'de "not equal" anlamına gelir, yani boş olmayan kayıtlar alınır.
export const getScrapReasons = async (_req: Request, res: Response) => {
  try {
    const records = await MesRepairReason.findAll({
      attributes: [
        [Sequelize.fn("DISTINCT", Sequelize.col("repair_reason")), "repair_reason"],
      ],
      where: {
        repair_reason: {
          [Op.ne]: "",
        },
      },
      order: [["repair_reason", "ASC"]], // ASC sıralama
      raw: true, // Ham veri döndürülür, model örneği değil
    });

    const reasons = records
      .map((r: any) => (r.repair_reason || "").trim())
      .filter((name: string) => name.length > 0);

    // new set ile tekrar eden kayıtlar elenir ve "Diğer" eklenir
    const uniqueReasons = Array.from(new Set(reasons));
    if (!uniqueReasons.includes("Diğer")) {
      uniqueReasons.push("Diğer");
    }

    return res.status(200).json(uniqueReasons.length > 1 ? uniqueReasons : FALLBACK_SCRAP_REASONS);
  } catch (error) {
    console.warn("MesRepairReason sorgusu yapılamadı, varsayılanlar dönülüyor:", error);
    return res.status(200).json(FALLBACK_SCRAP_REASONS);
  }
};
