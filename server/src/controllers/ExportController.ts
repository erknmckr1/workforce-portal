import { Request, Response } from "express";
import { Op } from "sequelize";
import {
  MesPartiLog,
  WorkLog,
  Measurement,
  ScrapMeasurement,
  Operator,
  SystemAuditLog,
} from "../models";

/**
 * @desc Belirtilen veri kümesini tarih ve bölüm filtrelerine göre JSON olarak döner
 * @route GET /api/export/data
 */
export const getExportData = async (req: Request, res: Response) => {
  try {
    const {
      dataset,
      startDate,
      endDate,
      areaName,
      limit = "5000",
    } = req.query;

    if (!dataset) {
      return res.status(400).json({ message: "Veri kümesi (dataset) belirtilmelidir." });
    }

    const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 10000, 1), 50000);

    // Tarih aralığı koşulu oluşturucu
    const buildDateRange = (dateField: string) => {
      const condition: any = {};
      if (startDate && endDate) {
        condition[dateField] = {
          [Op.between]: [
            new Date(`${startDate} 00:00:00`),
            new Date(`${endDate} 23:59:59`),
          ],
        };
      } else if (startDate) {
        condition[dateField] = {
          [Op.gte]: new Date(`${startDate} 00:00:00`),
        };
      } else if (endDate) {
        condition[dateField] = {
          [Op.lte]: new Date(`${endDate} 23:59:59`),
        };
      }
      return condition;
    };

    let data: any[] = [];

    switch (dataset) {
      case "parti_logs": {
        const whereClause: any = {
          ...buildDateRange("record_date"),
        };

        data = await MesPartiLog.findAll({
          where: whereClause,
          order: [["record_date", "DESC"]],
          limit: parsedLimit,
          raw: true,
        });
        break;
      }

      case "work_logs": {
        const whereClause: any = {
          ...buildDateRange("start_date"),
        };

        if (areaName && String(areaName).toLowerCase() !== "all") {
          whereClause.area_name = String(areaName).trim();
        }

        data = await WorkLog.findAll({
          where: whereClause,
          order: [["start_date", "DESC"]],
          limit: parsedLimit,
          raw: true,
        });
        break;
      }

      case "measurements": {
        const whereClause: any = {
          ...buildDateRange("createdAt"),
        };

        if (areaName && String(areaName).toLowerCase() !== "all") {
          whereClause.area_name = String(areaName).trim();
        }

        data = await Measurement.findAll({
          where: whereClause,
          order: [["createdAt", "DESC"]],
          limit: parsedLimit,
          raw: true,
        });
        break;
      }

      case "scrap_measurements": {
        const whereClause: any = {
          ...buildDateRange("createdAt"),
        };

        if (areaName && String(areaName).toLowerCase() !== "all") {
          whereClause.area_name = String(areaName).trim();
        }

        data = await ScrapMeasurement.findAll({
          where: whereClause,
          order: [["createdAt", "DESC"]],
          limit: parsedLimit,
          raw: true,
        });
        break;
      }

      default:
        return res.status(400).json({
          message: `Bilinmeyen veri kümesi: ${dataset}. Geçerli seçenekler: parti_logs, work_logs, measurements, scrap_measurements`,
        });
    }

    return res.status(200).json({
      dataset,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getExportData Error:", error);
    return res.status(500).json({
      message: "Veriler getirilirken bir sunucu hatası oluştu.",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
};

/**
 * @desc Mevcut kayıtlı benzersiz istasyon/bölüm adlarını döner
 * @route GET /api/export/areas
 */
export const getAvailableAreas = async (_req: Request, res: Response) => {
  try {
    const predefined = [
      { id: "taslama", name: "Taslama" },
      { id: "tezgah", name: "Tezgah" },
      { id: "cila", name: "Cila" },
      { id: "kalite", name: "Kalite Kontrol" },
      { id: "buzlama", name: "Buzlama" },
      { id: "cekic", name: "Çekiç" },
      { id: "kurutiras", name: "Kuru Tıraş" },
      { id: "telcekme", name: "Tel Çekme" },
    ];

    return res.status(200).json(predefined);
  } catch (error) {
    console.error("getAvailableAreas Error:", error);
    return res.status(500).json({ message: "Bölümler alınırken hata oluştu." });
  }
};

/**
 * @desc Operatör ID'sini doğrular ve Excel indirme hareketini system_audit_logs tablosuna kaydeder
 * @route POST /api/export/log-download
 */
export const logAndAuthorizeExport = async (req: Request, res: Response) => {
  try {
    const {
      operatorId,
      dataset,
      datasetTitle,
      areaName,
      startDate,
      endDate,
      recordCount,
      columns,
    } = req.body;

    if (!operatorId || !String(operatorId).trim()) {
      return res.status(400).json({ message: "Operatör/Kullanıcı ID zorunludur." });
    }

    const cleanId = String(operatorId).trim();

    // 1. Operatör doğrula (id_dec veya id_hex)
    const operator = await Operator.findOne({
      where: {
        [Op.or]: [{ id_dec: cleanId }, { id_hex: cleanId }],
      },
    });

    if (!operator) {
      return res.status(404).json({
        message: `ID (${cleanId}) sistemde kayıtlı bir personele ait değil.`,
      });
    }

    if (operator.is_active === 0) {
      return res.status(403).json({
        message: `Kullanıcı (${operator.name} ${operator.surname}) pasif durumdadır. İndirme yetkisi yok.`,
      });
    }

    const operatorFullName = `${operator.name} ${operator.surname}`.trim();
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      null;

    // 2. Audit log oluştur
    const auditRecord = await SystemAuditLog.create({
      operator_id: operator.id_dec,
      operator_name: operatorFullName,
      module: "DATA_EXPORT",
      action_type: "EXPORT_EXCEL",
      description: `${operatorFullName} tarafından '${datasetTitle || dataset}' veri kümesinden ${recordCount || 0} adet kayıt Excel (.xlsx) olarak indirildi.`,
      details: JSON.stringify({
        dataset,
        datasetTitle,
        areaName: areaName || "all",
        startDate: startDate || null,
        endDate: endDate || null,
        recordCount: recordCount || 0,
        columns: columns || [],
      }),
      ip_address: clientIp,
    });

    return res.status(200).json({
      success: true,
      operatorId: operator.id_dec,
      operatorName: operatorFullName,
      logId: auditRecord.id,
      message: `Doğrulama başarılı. Sn. ${operatorFullName}, rapor indiriliyor.`,
    });
  } catch (error) {
    console.error("logAndAuthorizeExport Error:", error);
    return res.status(500).json({
      message: "İndirme kaydı işlenirken bir sunucu hatası oluştu.",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
};
