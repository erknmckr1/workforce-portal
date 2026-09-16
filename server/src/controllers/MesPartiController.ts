import { Request, Response } from "express";
import { Op } from "sequelize";
import { MesPartiLog, Operator, PartiActionType, PARTI_ACTION_LABELS } from "../models";

/**
 * @desc Yeni bir parti işlemi log kaydı oluşturur (1: BAŞLA, 2: BİTİR vb.)
 * @route POST /api/mes/parti-logs
 */
export const createPartiLog = async (req: Request, res: Response) => {
  try {
    const {
      parti_no,
      alt_parti,
      islem_id,
      islem_label,
      action_type,
      action_label,
      operator_id,
      operator_name,
    } = req.body;

    // 1. Zorunlu Alan Kontrolleri
    if (!parti_no || String(parti_no).trim() === "") {
      return res.status(400).json({ message: "Parti numarası zorunludur." });
    }
    if (!alt_parti || String(alt_parti).trim() === "") {
      return res.status(400).json({ message: "Alt parti numarası zorunludur." });
    }
    if (!islem_id || String(islem_id).trim() === "") {
      return res.status(400).json({ message: "İşlem seçimi zorunludur." });
    }
    if (!operator_id || String(operator_id).trim() === "") {
      return res.status(400).json({ message: "Operatör ID bilgisi zorunludur." });
    }

    // 2. Action Type ID ve Label Dönüşümü (String veya Number esnekliği)
    let numericActionType: number;
    if (typeof action_type === "number") {
      numericActionType = action_type;
    } else if (String(action_type).toUpperCase() === "BASLA" || action_type === "1") {
      numericActionType = PartiActionType.BASLA;
    } else if (String(action_type).toUpperCase() === "BITIR" || action_type === "2") {
      numericActionType = PartiActionType.BITIR;
    } else if (String(action_type).toUpperCase() === "DURDUR" || action_type === "3") {
      numericActionType = PartiActionType.DURDUR;
    } else if (String(action_type).toUpperCase() === "IPTAL" || action_type === "4") {
      numericActionType = PartiActionType.IPTAL;
    } else {
      const parsed = parseInt(String(action_type), 10);
      if (isNaN(parsed)) {
        return res.status(400).json({
          message: "Geçerli bir işlem türü ID'si (1: BAŞLA, 2: BİTİR vb.) belirtilmelidir.",
        });
      }
      numericActionType = parsed;
    }

    const finalActionLabel =
      action_label ||
      PARTI_ACTION_LABELS[numericActionType] ||
      `Durum ${numericActionType}`;

    // 3. Operatör Doğrulama & İsim Zenginleştirme
    let finalOperatorName = operator_name;
    if (!finalOperatorName) {
      const op = await Operator.findOne({
        where: { id_dec: String(operator_id).trim() },
        attributes: ["name", "surname"],
      });
      if (op) {
        finalOperatorName = `${op.name} ${op.surname}`.trim();
      }
    }

    // 4. Varsayılan İşlem İsimlendirmesi
    const defaultLabels: Record<string, string> = {
      "1": "Tambır",
      "2": "Çt1",
      "3": "Kurutma",
      "4": "Eritme",
    };
    const finalIslemLabel =
      islem_label || defaultLabels[String(islem_id)] || `İşlem ${islem_id}`;

    // 5. Veritabanına Kayıt
    const newLog = await MesPartiLog.create({
      parti_no: String(parti_no).trim(),
      alt_parti: String(alt_parti).trim(),
      islem_id: String(islem_id).trim(),
      islem_label: finalIslemLabel,
      action_type: numericActionType,
      action_label: finalActionLabel,
      operator_id: String(operator_id).trim(),
      operator_name: finalOperatorName || null,
      record_date: new Date(),
    });

    return res.status(201).json({
      message: `Parti işlemi başarıyla kaydedildi (${finalActionLabel}).`,
      data: newLog,
    });
  } catch (error) {
    console.error("createPartiLog Error:", error);
    return res.status(500).json({
      message: "Parti işlemi kaydedilirken sunucu hatası oluştu.",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
};

/**
 * @desc Parti işlem loglarını filtreli, sayfalı (paginated) ve sıralı olarak listeler
 * @route GET /api/mes/parti-logs
 */
export const getPartiLogs = async (req: Request, res: Response) => {
  try {
    const {
      parti_no,
      alt_parti,
      operator_id,
      islem_id,
      action_type,
      startDate,
      endDate,
      page = "1",
      limit = "20",
    } = req.query;

    const whereClause: any = {};

    if (parti_no) {
      whereClause.parti_no = String(parti_no).trim();
    }
    if (alt_parti) {
      whereClause.alt_parti = String(alt_parti).trim();
    }
    if (operator_id) {
      whereClause.operator_id = String(operator_id).trim();
    }
    if (islem_id) {
      whereClause.islem_id = String(islem_id).trim();
    }
    if (action_type) {
      const parsedAction = parseInt(String(action_type), 10);
      if (!isNaN(parsedAction)) {
        whereClause.action_type = parsedAction;
      }
    }

    // Tarih Aralığı Filtresi
    if (startDate && endDate) {
      whereClause.record_date = {
        [Op.between]: [
          new Date(`${startDate} 00:00:00`),
          new Date(`${endDate} 23:59:59`),
        ],
      };
    } else if (startDate) {
      whereClause.record_date = {
        [Op.gte]: new Date(`${startDate} 00:00:00`),
      };
    }

    const parsedPage = Math.max(parseInt(String(page), 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 200);
    const offset = (parsedPage - 1) * parsedLimit;

    const { count, rows } = await MesPartiLog.findAndCountAll({
      where: whereClause,
      order: [["record_date", "DESC"]],
      limit: parsedLimit,
      offset,
    });

    const totalPages = Math.ceil(count / parsedLimit) || 1;

    return res.status(200).json({
      totalCount: count,
      totalPages,
      currentPage: parsedPage,
      limit: parsedLimit,
      data: rows,
    });
  } catch (error) {
    console.error("getPartiLogs Error:", error);
    return res.status(500).json({
      message: "Parti kayıtları getirilirken sunucu hatası oluştu.",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
};

/**
 * @desc Belirli bir parti log kaydını siler (Opsiyonel / Yönetici)
 * @route DELETE /api/mes/parti-logs/:id
 */
export const deletePartiLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const log = await MesPartiLog.findByPk(Number(id));

    if (!log) {
      return res.status(404).json({ message: "Kayıt bulunamadı." });
    }

    await log.destroy();
    return res.status(200).json({ message: "Parti kaydı başarıyla silindi." });
  } catch (error) {
    console.error("deletePartiLog Error:", error);
    return res.status(500).json({ message: "Silme işlemi sırasında sunucu hatası oluştu." });
  }
};
