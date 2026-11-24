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

    // Üretim Veritabanında (SapOrder) Sipariş Doğrulaması
    const cleanNo = String(order_no).replace(/^#/, "").trim();
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

    // Sipariş üretim veritabanında yoksa kesinlikle kaydetme!
    if (!sapOrder) {
      return res.status(400).json({
        message: `"${cleanNo}" numaralı sipariş üretim veritabanında bulunamadı. Hurda kaydı oluşturmak için geçerli ve kayıtlı bir sipariş numarası gereklidir.`,
      });
    }

    // Doğrulanan siparişten eksik bilgileri otomatik tamamla
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

    const verifiedOrderNo = sapOrder.ORDER_ID ? sapOrder.ORDER_ID.trim() : cleanNo;

    // Çoklu görsel dosyaları ve mevcut görselleri toplama
    const uploadedFiles = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    const newImageUrls = uploadedFiles.map((f) => `/uploads/scrap-images/${f.filename}`);

    let bodyImages: string[] = [];
    if (req.body.existing_images) {
      bodyImages = parseImageUrls(req.body.existing_images);
    } else if (req.body.image_url) {
      bodyImages = parseImageUrls(req.body.image_url);
    }

    const allImages = Array.from(new Set([...bodyImages, ...newImageUrls]));
    const finalImageUrl = allImages.length > 0 ? JSON.stringify(allImages) : null;

    const newRecord = await ScrapTracking.create({
      order_no: verifiedOrderNo,
      karat: finalKarat ? String(finalKarat).trim() : null,
      color: finalColor ? String(finalColor).trim() : null,
      description: finalDescription ? String(finalDescription).trim() : null,
      wire_code: finalWireCode ? String(finalWireCode).trim() : null,
      defect_note: defect_note ? String(defect_note).trim() : null,
      is_scrap: is_scrap === "true" || is_scrap === true,
      scrap_location: scrap_location ? String(scrap_location).trim() : null,
      scrap_reason: normalizeScrapReasons(scrap_reason),
      image_url: finalImageUrl,
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

// Birden fazla görsel URL'ini ayıklama ve diziye dönüştürme yardımcısı
export const parseImageUrls = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0 && s !== "/images/sample-scrap.svg");
  }
  const str = String(val).trim();
  if (!str || str === "/images/sample-scrap.svg") return [];
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed
          .map((s) => String(s).trim())
          .filter((s) => s.length > 0 && s !== "/images/sample-scrap.svg");
      }
    } catch {
      // ignore
    }
  }
  return str
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "/images/sample-scrap.svg");
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

    // Çoklu görsel yönetimi
    const previousImages = parseImageUrls(record.image_url);

    let keptImages: string[] = [];
    if (req.body.existing_images !== undefined) {
      keptImages = parseImageUrls(req.body.existing_images);
    } else if (req.body.image_url !== undefined && req.body.image_url !== "") {
      keptImages = parseImageUrls(req.body.image_url);
    } else if (req.body.remove_image !== "true") {
      keptImages = previousImages;
    }

    // Kullanıcının sildiği eski görselleri diskten temizle
    const removedImages = previousImages.filter((oldImg) => !keptImages.includes(oldImg));
    for (const imgPath of removedImages) {
      if (imgPath.startsWith("/uploads/scrap-images/")) {
        const oldFilename = imgPath.replace("/uploads/scrap-images/", "");
        const oldPath = path.join(getScrapUploadDir(), oldFilename);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.warn("Eski görsel silinemedi:", e);
          }
        }
      }
    }

    // Yeni yüklenen dosyalar
    const uploadedFiles = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    const newImageUrls = uploadedFiles.map((f) => `/uploads/scrap-images/${f.filename}`);

    const allImages = Array.from(new Set([...keptImages, ...newImageUrls]));
    const nextImageUrl = allImages.length > 0 ? JSON.stringify(allImages) : null;
    const imageChanged = JSON.stringify(previousImages) !== JSON.stringify(allImages);
    const imageUrl = nextImageUrl;

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

    // Görsel dosyalarını sil
    const imagesToDelete = parseImageUrls(record.image_url);
    for (const imgPath of imagesToDelete) {
      if (imgPath.startsWith("/uploads/scrap-images/")) {
        const filename = imgPath.replace("/uploads/scrap-images/", "");
        const filePath = path.join(getScrapUploadDir(), filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.warn("Görsel silinemedi:", e);
          }
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
    const { start_date, end_date, location, karat, color, is_scrap } = req.query;
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

    if (location && String(location).trim() !== "ALL") {
      where.scrap_location = String(location).trim();
    }

    if (karat && String(karat).trim() !== "ALL") {
      const cleanKarat = String(karat).replace(/[^0-9]/g, "").trim();
      if (cleanKarat) {
        where.karat = cleanKarat;
      }
    }

    if (color && String(color).trim() !== "ALL") {
      where.color = String(color).trim();
    }

    if (is_scrap !== undefined && is_scrap !== "ALL" && is_scrap !== "") {
      where.is_scrap = String(is_scrap) === "true";
    }

    // 1. Filtrelenmiş kayıtlar
    const records = await ScrapTracking.findAll({
      where,
      attributes: [
        "id",
        "order_no",
        "karat",
        "color",
        "description",
        "wire_code",
        "is_scrap",
        "scrap_location",
        "scrap_reason",
        "created_at",
      ],
      order: [["created_at", "ASC"]],
    });

    // SapOrder eşleştirmesi (MATERIAL_NO ve MATERIAL_DESCRIPTION için)
    const distinctOrders = Array.from(
      new Set(records.map((r) => r.order_no.replace(/^#/, "").trim()))
    );
    const orderCandidates: string[] = [];
    distinctOrders.forEach((o) => {
      orderCandidates.push(o, `${o} `, `${o}  `);
    });

    const sapOrders =
      orderCandidates.length > 0
        ? await SapOrder.findAll({
            where: { ORDER_ID: { [Op.in]: orderCandidates } },
            attributes: [
              "ORDER_ID",
              "MATERIAL_NO",
              "MATERIAL_DESCRIPTION",
              "ITEM_DESCRIPTION",
              "GENERAL_DESCRIPTION",
            ],
            raw: true,
          })
        : [];

    const sapMap: Record<string, any> = {};
    sapOrders.forEach((s: any) => {
      sapMap[s.ORDER_ID.trim()] = s;
    });

    // 2. Dinamik Filtre Seçenekleri (Tüm veritabanından çekilir)
    const allRecordsForFilters = await ScrapTracking.findAll({
      attributes: ["scrap_location", "karat"],
    });
    const availableLocations = Array.from(
      new Set(allRecordsForFilters.map((r) => r.scrap_location).filter(Boolean))
    ).sort();
    const availableKarats = Array.from(
      new Set(allRecordsForFilters.map((r) => (r.karat ? `${r.karat}K` : null)).filter(Boolean))
    ).sort((a: any, b: any) => parseInt(a) - parseInt(b));

    const totalCount = records.length;
    const scrapCount = records.filter((r) => r.is_scrap).length;
    const pendingCount = totalCount - scrapCount;
    const scrapRate = totalCount > 0 ? Number(((scrapCount / totalCount) * 100).toFixed(1)) : 0;

    // İstasyon bazında dağılım ve istasyon hata haritası
    const locationMap: Record<string, { total: number; scrap: number; pending: number }> = {};
    const locationDefectMap: Record<string, Record<string, number>> = {};

    // Neden dağılımı (Pareto)
    const reasonMap: Record<string, number> = {};

    // Ayar dağılımı (detaylı: count, scrap, pending)
    const karatMap: Record<string, { total: number; scrap: number; pending: number }> = {};

    // Renk dağılımı
    const colorMap: Record<string, { total: number; scrap: number; pending: number }> = {};

    // Tel Kodu / Malzeme dağılımı
    const wireCodeMap: Record<string, { total: number; scrap: number; pending: number }> = {};

    // Malzeme (MATERIAL_NO) bazlı detaylı dağılım
    const materialMap: Record<
      string,
      {
        material_no: string;
        description: string;
        count: number;
        scrap: number;
        pending: number;
        orders: Set<string>;
        reasons: Record<string, number>;
        locations: Record<string, number>;
      }
    > = {};

    // Tarihsel trend (günlük)
    const dailyMap: Record<string, { date: string; scrap: number; pending: number; total: number }> = {};

    for (const r of records) {
      const loc = r.scrap_location || "BELİRTİLMEDİ";
      if (!locationMap[loc]) locationMap[loc] = { total: 0, scrap: 0, pending: 0 };
      if (!locationDefectMap[loc]) locationDefectMap[loc] = {};
      locationMap[loc].total++;
      if (r.is_scrap) locationMap[loc].scrap++;
      else locationMap[loc].pending++;

      // Nedenler (virgülle ayrılmış çoklu nedenler)
      if (r.scrap_reason) {
        const subReasons = r.scrap_reason
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        for (const sub of subReasons) {
          reasonMap[sub] = (reasonMap[sub] || 0) + 1;
          locationDefectMap[loc][sub] = (locationDefectMap[loc][sub] || 0) + 1;
        }
      } else {
        reasonMap["Belirtilmedi"] = (reasonMap["Belirtilmedi"] || 0) + 1;
        locationDefectMap[loc]["Belirtilmedi"] = (locationDefectMap[loc]["Belirtilmedi"] || 0) + 1;
      }

      // Ayar (Karat)
      const karatKey = r.karat ? `${r.karat}K` : "Belirtilmedi";
      if (!karatMap[karatKey]) karatMap[karatKey] = { total: 0, scrap: 0, pending: 0 };
      karatMap[karatKey].total++;
      if (r.is_scrap) karatMap[karatKey].scrap++;
      else karatMap[karatKey].pending++;

      // Renk
      const colorRaw = (r.color || "Y").toUpperCase();
      const colorKey = colorRaw.startsWith("B") ? "B" : (colorRaw.startsWith("K") || colorRaw.startsWith("R")) ? "K" : "Y";
      if (!colorMap[colorKey]) colorMap[colorKey] = { total: 0, scrap: 0, pending: 0 };
      colorMap[colorKey].total++;
      if (r.is_scrap) colorMap[colorKey].scrap++;
      else colorMap[colorKey].pending++;

      // Tel Kodu
      if (r.wire_code) {
        const wireKey = String(r.wire_code).trim();
        if (!wireCodeMap[wireKey]) wireCodeMap[wireKey] = { total: 0, scrap: 0, pending: 0 };
        wireCodeMap[wireKey].total++;
        if (r.is_scrap) wireCodeMap[wireKey].scrap++;
        else wireCodeMap[wireKey].pending++;
      }

      // Malzeme Kodu (MATERIAL_NO öncelikli)
      const oClean = r.order_no.replace(/^#/, "").trim();
      const sap = sapMap[oClean];
      const matNo = (
        r.wire_code ||
        (sap && sap.MATERIAL_NO ? sap.MATERIAL_NO.trim() : null) ||
        "Belirtilmedi"
      ).trim();

      const matDesc =
        (sap && sap.MATERIAL_DESCRIPTION ? sap.MATERIAL_DESCRIPTION.trim() : "") ||
        r.description ||
        "-";

      if (!materialMap[matNo]) {
        materialMap[matNo] = {
          material_no: matNo,
          description: matDesc,
          count: 0,
          scrap: 0,
          pending: 0,
          orders: new Set<string>(),
          reasons: {},
          locations: {},
        };
      }
      const matEntry = materialMap[matNo];
      matEntry.count++;
      if (r.is_scrap) matEntry.scrap++;
      else matEntry.pending++;
      matEntry.orders.add(r.order_no);

      if (r.scrap_reason) {
        const subs = r.scrap_reason.split(",").map((s: string) => s.trim()).filter(Boolean);
        subs.forEach((s: string) => {
          matEntry.reasons[s] = (matEntry.reasons[s] || 0) + 1;
        });
      }
      if (r.scrap_location) {
        matEntry.locations[r.scrap_location] = (matEntry.locations[r.scrap_location] || 0) + 1;
      }

      // Günlük Trend
      const dayKey = new Date(r.created_at).toISOString().split("T")[0];
      if (!dailyMap[dayKey]) dailyMap[dayKey] = { date: dayKey, scrap: 0, pending: 0, total: 0 };
      dailyMap[dayKey].total++;
      if (r.is_scrap) dailyMap[dayKey].scrap++;
      else dailyMap[dayKey].pending++;
    }

    // İstasyon listesi ve en sık görülen hatası (primaryDefect)
    const byLocation = Object.entries(locationMap)
      .map(([name, data]) => {
        const defects = Object.entries(locationDefectMap[name] || {}).sort((a, b) => b[1] - a[1]);
        const primaryDefect = defects[0] ? defects[0][0] : "Çeşitli Nedenler";
        const rate = data.total > 0 ? Math.round((data.scrap / data.total) * 100) : 0;
        return {
          name,
          ...data,
          scrapRate: rate,
          primaryDefect,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Hata nedenleri (Pareto)
    const totalReasonsCount = Object.values(reasonMap).reduce((a, b) => a + b, 0);
    const byReason = Object.entries(reasonMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalReasonsCount > 0 ? Number(((count / totalReasonsCount) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Ayar kırılımı
    const byKarat = Object.entries(karatMap)
      .map(([name, data]) => ({
        name,
        count: data.total,
        scrap: data.scrap,
        pending: data.pending,
        scrapRate: data.total > 0 ? Math.round((data.scrap / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Renk kırılımı
    const colorNames: Record<string, string> = {
      Y: "Sarı Altın",
      B: "Beyaz Altın",
      K: "Kırmızı / Rose Altın",
    };
    const byColor = Object.entries(colorMap)
      .map(([code, data]) => ({
        code,
        name: colorNames[code] || "Diğer",
        count: data.total,
        scrap: data.scrap,
        pending: data.pending,
      }))
      .sort((a, b) => b.count - a.count);

    // Malzeme Kırılımı (MATERIAL_NO Bazında)
    const byMaterial = Object.values(materialMap)
      .map((m) => {
        const sortedReasons = Object.entries(m.reasons).sort((a, b) => b[1] - a[1]);
        const sortedLocations = Object.entries(m.locations).sort((a, b) => b[1] - a[1]);
        return {
          material_no: m.material_no,
          description: m.description,
          count: m.count,
          scrap: m.scrap,
          pending: m.pending,
          orderCount: m.orders.size,
          primaryDefect: sortedReasons[0] ? sortedReasons[0][0] : "Belirtilmedi",
          primaryLocation: sortedLocations[0] ? sortedLocations[0][0] : "Belirtilmedi",
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Tel Kodu (Geriye uyumluluk için byMaterial'dan beslenir)
    const byWireCode = byMaterial.map((m) => ({
      wire_code: m.material_no,
      count: m.count,
      scrap: m.scrap,
      pending: m.pending,
    }));

    // Madde 1: Taslak Kök Neden Sınıflandırması (Kullanıcı sonradan içini dolduracaktır)
    const DRAFT_CATEGORIES = [
      {
        id: "METALLURGIC",
        name: "Metalurjik / Döküm & Alaşım",
        keywords: ["döküm", "porozite", "boşluk", "alaşım", "renk"],
        color: "#f59e0b",
      },
      {
        id: "MECHANICAL",
        name: "Mekanik / Makine & Tel Çekme",
        keywords: [
          "tel",
          "kop",
          "ezil",
          "çapak",
          "deformasyon",
          "ölçü",
          "tolerans",
          "makara",
          "boy hatası",
        ],
        color: "#3b82f6",
      },
      {
        id: "WORKMANSHIP",
        name: "İşçilik, Yüzey & Montaj",
        keywords: ["yüzey", "çizik", "kaynak", "lehim", "montaj", "taş", "çatlak", "kırık"],
        color: "#a855f7",
      },
    ];

    const categoryCounts: Record<string, { count: number; reasons: Record<string, number> }> = {
      METALLURGIC: { count: 0, reasons: {} },
      MECHANICAL: { count: 0, reasons: {} },
      WORKMANSHIP: { count: 0, reasons: {} },
      OTHER: { count: 0, reasons: {} },
    };

    let totalCategorized = 0;
    for (const [reason, count] of Object.entries(reasonMap)) {
      const lower = reason.toLowerCase();
      let matchedCat = "OTHER";
      for (const cat of DRAFT_CATEGORIES) {
        if (cat.keywords.some((k) => lower.includes(k))) {
          matchedCat = cat.id;
          break;
        }
      }
      categoryCounts[matchedCat].count += count;
      categoryCounts[matchedCat].reasons[reason] = count;
      totalCategorized += count;
    }

    const rootCauseDraft = [
      ...DRAFT_CATEGORIES.map((cat) => ({
        id: cat.id,
        name: cat.name,
        count: categoryCounts[cat.id].count,
        percentage:
          totalCategorized > 0
            ? Number(((categoryCounts[cat.id].count / totalCategorized) * 100).toFixed(1))
            : 0,
        color: cat.color,
        topReasons: Object.entries(categoryCounts[cat.id].reasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, c]) => ({ name, count: c })),
      })),
      {
        id: "OTHER",
        name: "Sınıflandırılacak / Diğer",
        count: categoryCounts.OTHER.count,
        percentage:
          totalCategorized > 0
            ? Number(((categoryCounts.OTHER.count / totalCategorized) * 100).toFixed(1))
            : 0,
        color: "#64748b",
        topReasons: Object.entries(categoryCounts.OTHER.reasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, c]) => ({ name, count: c })),
      },
    ];

    // Madde 3: İstasyon × Hata Çapraz Isı Haritası / Matrisi
    const topReasonsList = byReason.slice(0, 6).map((r) => r.name);
    const stationDefectMatrix = {
      reasons: topReasonsList,
      rows: byLocation.map((loc) => {
        const counts: Record<string, number> = {};
        topReasonsList.forEach((rName) => {
          counts[rName] = locationDefectMap[loc.name]?.[rName] || 0;
        });
        return {
          location: loc.name,
          total: loc.total,
          scrap: loc.scrap,
          counts,
        };
      }),
    };

    // Günlük trend (tarihe göre sıralı)
    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

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
      byColor,
      byWireCode,
      byMaterial,
      rootCauseDraft,
      stationDefectMatrix,
      dailyTrend,
      availableFilters: {
        locations: availableLocations,
        karats: availableKarats,
      },
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
