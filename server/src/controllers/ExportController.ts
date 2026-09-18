import { Request, Response } from "express";
import { Op } from "sequelize";
import * as XLSX from "xlsx";
import {
  MesPartiLog,
  WorkLog,
  Measurement,
  ScrapMeasurement,
  Operator,
  SystemAuditLog,
} from "../models";

// Tarih aralığı koşulu oluşturucu (MSSQL uyumlu yerel saat dilimi sınırları)
const buildDateRange = (dateField: string, startDate?: string, endDate?: string) => {
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

// Veri kümesini sorgulama fonksiyonu
const fetchDatasetRecords = async (
  dataset: string,
  startDate?: string,
  endDate?: string,
  areaName?: string,
  limit?: number
) => {
  let whereClause: any = {};
  let orderField = "createdAt";

  switch (dataset) {
    case "parti_logs": {
      whereClause = buildDateRange("record_date", startDate, endDate);
      orderField = "record_date";
      return await MesPartiLog.findAll({
        where: whereClause,
        order: [[orderField, "DESC"]],
        ...(limit ? { limit } : {}),
        raw: true,
      });
    }

    case "work_logs": {
      whereClause = buildDateRange("start_date", startDate, endDate);
      if (areaName && String(areaName).toLowerCase() !== "all") {
        whereClause.area_name = String(areaName).trim();
      }
      orderField = "start_date";
      return await WorkLog.findAll({
        where: whereClause,
        order: [[orderField, "DESC"]],
        ...(limit ? { limit } : {}),
        raw: true,
      });
    }

    case "measurements": {
      whereClause = buildDateRange("createdAt", startDate, endDate);
      if (areaName && String(areaName).toLowerCase() !== "all") {
        whereClause.area_name = String(areaName).trim();
      }
      return await Measurement.findAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
        ...(limit ? { limit } : {}),
        raw: true,
      });
    }

    case "scrap_measurements": {
      whereClause = buildDateRange("createdAt", startDate, endDate);
      if (areaName && String(areaName).toLowerCase() !== "all") {
        whereClause.area_name = String(areaName).trim();
      }
      return await ScrapMeasurement.findAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
        ...(limit ? { limit } : {}),
        raw: true,
      });
    }

    default:
      throw new Error(`Bilinmeyen veri kümesi: ${dataset}`);
  }
};

/**
 * @desc UI Tablo Önizlemesi ve Toplam Kayıt Sayısı için hızlı veri döner
 * @route GET /api/export/data
 */
export const getExportData = async (req: Request, res: Response) => {
  try {
    const { dataset, startDate, endDate, areaName } = req.query;

    if (!dataset) {
      return res.status(400).json({ message: "Veri kümesi (dataset) belirtilmelidir." });
    }

    // 1. UI Tablo önizlemesi için ilk 50 kaydı getir (Tarayıcıyı asla yormaz)
    const previewData = await fetchDatasetRecords(
      String(dataset),
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
      areaName ? String(areaName) : undefined,
      50
    );

    // 2. Seçilen filtredeki toplam gerçek kayıt sayısını hesapla
    let totalCount = 0;
    const sDate = startDate ? String(startDate) : undefined;
    const eDate = endDate ? String(endDate) : undefined;
    const aName = areaName ? String(areaName) : undefined;

    switch (dataset) {
      case "parti_logs":
        totalCount = await MesPartiLog.count({ where: buildDateRange("record_date", sDate, eDate) });
        break;
      case "work_logs": {
        const wClause: any = buildDateRange("start_date", sDate, eDate);
        if (aName && aName.toLowerCase() !== "all") wClause.area_name = aName.trim();
        totalCount = await WorkLog.count({ where: wClause });
        break;
      }
      case "measurements": {
        const wClause: any = buildDateRange("createdAt", sDate, eDate);
        if (aName && aName.toLowerCase() !== "all") wClause.area_name = aName.trim();
        totalCount = await Measurement.count({ where: wClause });
        break;
      }
      case "scrap_measurements": {
        const wClause: any = buildDateRange("createdAt", sDate, eDate);
        if (aName && aName.toLowerCase() !== "all") wClause.area_name = aName.trim();
        totalCount = await ScrapMeasurement.count({ where: wClause });
        break;
      }
    }

    return res.status(200).json({
      dataset,
      totalCount,
      count: previewData.length,
      data: previewData,
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
 * @desc Backend üzerinde Excel dosyasını oluşturur ve doğrudan tarayıcıya stream/dosya olarak gönderir
 * @route POST /api/export/download-excel
 */
export const downloadExcelFile = async (req: Request, res: Response) => {
  try {
    const {
      operatorId,
      dataset,
      datasetTitle,
      areaName,
      startDate,
      endDate,
      columns, // Array of { key: string, label: string }
    } = req.body;

    if (!operatorId || !String(operatorId).trim()) {
      return res.status(400).json({ message: "Operatör/Kullanıcı ID zorunludur." });
    }

    const cleanId = String(operatorId).trim();

    // 1. Operatör doğrula
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

    // 2. Verileri limit olmadan çek (Tarih aralığındaki tüm kayıtlar)
    const records = await fetchDatasetRecords(
      String(dataset),
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
      areaName ? String(areaName) : undefined
    );

    // 3. Sütun eşleştirmesini hazırla
    const columnDefs: Array<{ key: string; label: string }> = Array.isArray(columns) && columns.length > 0
      ? columns
      : [];

    // Durum haritası
    const statusMap: Record<number, string> = {
      1: "Başladı",
      2: "Duraklatıldı",
      3: "İptal Edildi",
      4: "Tamamlandı",
      5: "Hazırlık (Setup)",
      9: "Durduruldu",
    };

    // 4. Excel satırlarını hazırla
    const rowsForExcel = records.map((row: any) => {
      const item: Record<string, any> = {};

      if (columnDefs.length > 0) {
        columnDefs.forEach((col) => {
          let val = row[col.key];

          // Formatlamalar
          if (val === null || val === undefined) {
            val = "-";
          } else if (col.key === "status" && typeof val === "number" && statusMap[val]) {
            val = statusMap[val];
          } else if (
            (col.key.includes("date") || col.key.includes("Time") || col.key === "createdAt") &&
            val instanceof Date
          ) {
            val = val.toLocaleString("tr-TR");
          } else if (typeof val === "number") {
            val = Number.isInteger(val) ? val : Number(val.toFixed(3));
          }

          item[col.label] = val;
        });
      } else {
        // Kolon seçilmediyse ham objeyi bas
        Object.keys(row).forEach((k) => {
          item[k] = row[k];
        });
      }

      return item;
    });

    // 5. SheetJS ile bellek içinde Excel dosyasını üret
    const worksheet = XLSX.utils.json_to_sheet(rowsForExcel);

    // Sütun genişlikleri
    if (columnDefs.length > 0) {
      worksheet["!cols"] = columnDefs.map((col) => ({
        wch: Math.max(col.label.length + 5, 14),
      }));
    }

    const workbook = XLSX.utils.book_new();
    const sheetTitle = (datasetTitle || dataset).slice(0, 30);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // 6. Denetim logunu (system_audit_logs) kaydet
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      null;

    await SystemAuditLog.create({
      operator_id: operator.id_dec,
      operator_name: operatorFullName,
      module: "DATA_EXPORT",
      action_type: "EXPORT_EXCEL",
      description: `${operatorFullName} tarafından '${datasetTitle || dataset}' veri kümesinden ${records.length} adet kayıt backend üzerinden Excel (.xlsx) olarak indirildi.`,
      details: JSON.stringify({
        dataset,
        datasetTitle,
        areaName: areaName || "all",
        startDate: startDate || null,
        endDate: endDate || null,
        recordCount: records.length,
        columns: columnDefs.map((c) => c.label),
      }),
      ip_address: clientIp,
    });

    // 7. Dosyayı HTTP yanıtı olarak tarayıcıya bas
    const filename = `${dataset}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Record-Count", String(records.length));
    res.setHeader("X-Operator-Name", encodeURIComponent(operatorFullName));

    return res.send(excelBuffer);
  } catch (error) {
    console.error("downloadExcelFile Error:", error);
    return res.status(500).json({
      message: "Excel dosyası oluşturulurken bir sunucu hatası oluştu.",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
};

/**
 * @desc Operatör ID'sini doğrular (Modal içinde ön kontrol için)
 * @route POST /api/export/log-download
 */
export const logAndAuthorizeExport = async (req: Request, res: Response) => {
  try {
    const { operatorId } = req.body;

    if (!operatorId || !String(operatorId).trim()) {
      return res.status(400).json({ message: "Operatör/Kullanıcı ID zorunludur." });
    }

    const cleanId = String(operatorId).trim();

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

    return res.status(200).json({
      success: true,
      operatorId: operator.id_dec,
      operatorName: operatorFullName,
      message: `Doğrulama başarılı. Sn. ${operatorFullName}, rapor indiriliyor.`,
    });
  } catch (error) {
    console.error("logAndAuthorizeExport Error:", error);
    return res.status(500).json({
      message: "Kullanıcı doğrulanırken hata oluştu.",
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    });
  }
};
