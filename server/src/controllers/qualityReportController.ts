import { Request, Response } from "express";
import { sequelize } from "../models";
import { QueryTypes } from "sequelize";

/**
 * KALİTE KONTROL RAPORU KONTROLCÜSÜ (Clean Code & Domain Driven)
 * /uretim/montaj/kalite istasyonundaki work_logs ve work_log_repairs verilerini analiz eder.
 */

interface FilterParams {
  startDate?: string;
  endDate?: string;
  operatorId?: string;
  defectReason?: string;
  targetDept?: string;
  search?: string;
}

const buildDateConditions = (startDate?: string, endDate?: string, tableAlias = "w") => {
  const conditions: string[] = [];
  const replacements: Record<string, any> = {};

  if (startDate) {
    conditions.push(`${tableAlias}.start_date >= :startDate`);
    replacements.startDate = `${startDate} 00:00:00`;
  }
  if (endDate) {
    conditions.push(`${tableAlias}.start_date <= :endDate`);
    replacements.endDate = `${endDate} 23:59:59.999`;
  }

  return {
    whereClause: conditions.length > 0 ? ` AND ${conditions.join(" AND ")}` : "",
    replacements,
  };
};

// 1. ÖZET KPI'LAR, GRAFİKLER VE OPERATÖR PERFORMANSI
export const getQualityReportSummary = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate, operatorId, defectReason, targetDept } = req.query as FilterParams;

    const { whereClause: dateWhereW, replacements } = buildDateConditions(startDate, endDate, "w");

    // Ekstra filtreler
    let extraFilterW = "";
    let extraFilterR = "";

    if (operatorId && operatorId !== "ALL") {
      extraFilterW += " AND w.operator_id = :operatorId";
      replacements.operatorId = String(operatorId);
    }
    if (defectReason && defectReason !== "ALL") {
      extraFilterR += " AND r.repair_reason_name = :defectReason";
      replacements.defectReason = String(defectReason);
    }
    if (targetDept && targetDept !== "ALL") {
      if (targetDept === "DİĞER" || targetDept === "Diğer / Belirtilmemiş") {
        extraFilterR += " AND (r.target_department IS NULL OR TRIM(r.target_department) = '')";
      } else {
        extraFilterR += " AND UPPER(TRIM(r.target_department)) = :targetDept";
        replacements.targetDept = String(targetDept).toUpperCase();
      }
    }

    // Paralel Veri Çekme (Performans ve Temiz Kod İçin)
    const [
      summaryRows,
      repairsSummaryRows,
      topReasonsRows,
      targetDeptsRows,
      operatorPerformanceRows,
      dailyTrendRows,
      availableOperatorsRows,
    ] = await Promise.all([
      // 1. Genel İş Emri Özeti
      sequelize.query(
        `SELECT 
          COUNT(*) as total_checks,
          ISNULL(ROUND(SUM(produced_qty_gr), 2), 0) as total_good_gr,
          COUNT(DISTINCT order_no) as total_orders,
          COUNT(DISTINCT material_no) as total_materials
        FROM work_logs w
        WHERE w.area_name = 'kalite' AND w.status = 4 ${dateWhereW} ${extraFilterW}`,
        { replacements, type: QueryTypes.SELECT }
      ),

      // 2. Tamir Kayıtları Özeti
      sequelize.query(
        `SELECT 
          COUNT(r.id) as total_repair_items,
          ISNULL(ROUND(SUM(r.qty), 2), 0) as total_repair_gr,
          COUNT(DISTINCT w.id) as jobs_with_repair
        FROM work_log_repairs r
        INNER JOIN work_logs w ON r.work_log_id = w.id
        WHERE w.area_name = 'kalite' AND w.status = 4 ${dateWhereW} ${extraFilterW} ${extraFilterR}`,
        { replacements, type: QueryTypes.SELECT }
      ),

      // 3. Kusur Nedenleri Pareto Dağılımı (Top 12)
      sequelize.query(
        `SELECT TOP 12
          r.repair_reason_id as reason_id,
          r.repair_reason_name as reason_name,
          COUNT(r.id) as count,
          ISNULL(ROUND(SUM(r.qty), 2), 0) as total_qty
        FROM work_log_repairs r
        INNER JOIN work_logs w ON r.work_log_id = w.id
        WHERE w.area_name = 'kalite' AND w.status = 4 ${dateWhereW} ${extraFilterW} ${extraFilterR}
        GROUP BY r.repair_reason_id, r.repair_reason_name
        ORDER BY count DESC`,
        { replacements, type: QueryTypes.SELECT }
      ),

      // 4. Hedef Bölüm Kırılımı (Normalize edilmiş)
      sequelize.query(
        `SELECT 
          CASE 
            WHEN r.target_department IS NULL OR TRIM(r.target_department) = '' THEN 'Diğer / Belirtilmemiş'
            WHEN UPPER(TRIM(r.target_department)) IN ('CİLA', 'CILA') THEN 'CİLA'
            ELSE UPPER(TRIM(r.target_department))
          END as department,
          COUNT(r.id) as count,
          ISNULL(ROUND(SUM(r.qty), 2), 0) as total_qty
        FROM work_log_repairs r
        INNER JOIN work_logs w ON r.work_log_id = w.id
        WHERE w.area_name = 'kalite' AND w.status = 4 ${dateWhereW} ${extraFilterW} ${extraFilterR}
        GROUP BY 
          CASE 
            WHEN r.target_department IS NULL OR TRIM(r.target_department) = '' THEN 'Diğer / Belirtilmemiş'
            WHEN UPPER(TRIM(r.target_department)) IN ('CİLA', 'CILA') THEN 'CİLA'
            ELSE UPPER(TRIM(r.target_department))
          END
        ORDER BY count DESC`,
        { replacements, type: QueryTypes.SELECT }
      ),

      // 5. Operatör Performansı (Kontrol Sayısı, Sağlam Gr, Tespit Edilen Tamir Gr ve Oran)
      sequelize.query(
        `SELECT 
          w.operator_id,
          ISNULL(NULLIF(TRIM(CONCAT(o.name, ' ', o.surname)), ''), CONCAT('Personel (', w.operator_id, ')')) as operator_name,
          COUNT(DISTINCT w.id) as total_checks,
          ISNULL(ROUND(SUM(w.produced_qty_gr), 2), 0) as total_good_gr,
          COUNT(r.id) as repair_items_count,
          ISNULL(ROUND(SUM(r.qty), 2), 0) as total_repair_gr,
          COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN w.id END) as jobs_with_repair
        FROM work_logs w
        LEFT JOIN operator_table o ON w.operator_id = o.id_dec
        LEFT JOIN work_log_repairs r ON w.id = r.work_log_id
        WHERE w.area_name = 'kalite' AND w.status = 4 ${dateWhereW} ${extraFilterW}
        GROUP BY w.operator_id, o.name, o.surname
        ORDER BY total_checks DESC`,
        { replacements, type: QueryTypes.SELECT }
      ),

      // 6. Günlük Zaman Seyri (Son 30 Gün veya Seçili Tarih)
      sequelize.query(
        `SELECT 
          CONVERT(VARCHAR(10), w.start_date, 120) as date_key,
          COUNT(DISTINCT w.id) as total_checks,
          ISNULL(ROUND(SUM(w.produced_qty_gr), 2), 0) as total_good_gr,
          COUNT(r.id) as repair_count,
          ISNULL(ROUND(SUM(r.qty), 2), 0) as total_repair_gr
        FROM work_logs w
        LEFT JOIN work_log_repairs r ON w.id = r.work_log_id
        WHERE w.area_name = 'kalite' AND w.status = 4 ${dateWhereW} ${extraFilterW}
        GROUP BY CONVERT(VARCHAR(10), w.start_date, 120)
        ORDER BY date_key ASC`,
        { replacements, type: QueryTypes.SELECT }
      ),

      // 7. Filtre Dropdown'ı için Kalite Operatörleri Listesi
      sequelize.query(
        `SELECT DISTINCT 
          w.operator_id,
          ISNULL(NULLIF(TRIM(CONCAT(o.name, ' ', o.surname)), ''), CONCAT('Personel (', w.operator_id, ')')) as operator_name
        FROM work_logs w
        LEFT JOIN operator_table o ON w.operator_id = o.id_dec
        WHERE w.area_name = 'kalite' AND w.status = 4
        ORDER BY operator_name ASC`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    const summaryData: any = (summaryRows as any[])?.[0] || {};
    const repairsSummaryData: any = (repairsSummaryRows as any[])?.[0] || {};

    const totalChecks = Number(summaryData.total_checks || 0);
    const totalGoodGr = Number(summaryData.total_good_gr || 0);
    const totalRepairGr = Number(repairsSummaryData.total_repair_gr || 0);
    const totalRepairItems = Number(repairsSummaryData.total_repair_items || 0);
    const totalHandledGr = totalGoodGr + totalRepairGr;

    // Fire / Tamir Oranı
    const repairRate = totalHandledGr > 0 ? Number(((totalRepairGr / totalHandledGr) * 100).toFixed(2)) : 0;

    // En yaygın hata
    const topReasons = (topReasonsRows || []) as any[];
    const topDefect = topReasons.length > 0 ? topReasons[0].reason_name : "Kayıt Yok";

    // En çok sevk edilen bölüm
    const targetDepts = (targetDeptsRows || []) as any[];
    const topDept = targetDepts.length > 0 ? targetDepts[0].department : "Kayıt Yok";

    // Operatör performans verilerine oran hesaplama
    const operatorPerformance = ((operatorPerformanceRows || []) as any[]).map((op) => {
      const checks = Number(op.total_checks || 0);
      const jobsWithRepair = Number(op.jobs_with_repair || 0);
      const detectionRate = checks > 0 ? Number(((jobsWithRepair / checks) * 100).toFixed(1)) : 0;
      return {
        operatorId: op.operator_id,
        operatorName: op.operator_name,
        totalChecks: checks,
        totalGoodGr: Number(op.total_good_gr || 0),
        repairItemsCount: Number(op.repair_items_count || 0),
        totalRepairGr: Number(op.total_repair_gr || 0),
        jobsWithRepair,
        detectionRate,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalChecks,
          totalGoodGr,
          totalRepairGr,
          totalRepairItems,
          totalOrders: Number(summaryData.total_orders || 0),
          totalMaterials: Number(summaryData.total_materials || 0),
          repairRate,
          topDefect,
          topDept,
        },
        dailyTrend: (dailyTrendRows || []).map((d: any) => ({
          date: d.date_key,
          totalChecks: Number(d.total_checks || 0),
          goodGr: Number(d.total_good_gr || 0),
          repairCount: Number(d.repair_count || 0),
          repairGr: Number(d.total_repair_gr || 0),
        })),
        defectPareto: topReasons.map((r: any) => ({
          reasonId: r.reason_id,
          reasonName: r.reason_name,
          count: Number(r.count || 0),
          totalQty: Number(r.total_qty || 0),
        })),
        departmentBreakdown: targetDepts.map((d: any) => ({
          department: d.department,
          count: Number(d.count || 0),
          totalQty: Number(d.total_qty || 0),
        })),
        operatorPerformance,
        availableOperators: (availableOperatorsRows || []).map((o: any) => ({
          id: o.operator_id,
          name: o.operator_name,
        })),
      },
    });
  } catch (error) {
    console.error("[QualityReportController] getQualityReportSummary Error:", error);
    return res.status(500).json({ success: false, message: "Kalite rapor özeti çekilirken hata oluştu." });
  }
};

// 2. DETAYLI VE SAYFALAMALI TAMİR / KALİTE KAYITLARI LİSTESİ
export const getQualityReportDetails = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      startDate,
      endDate,
      operatorId,
      defectReason,
      targetDept,
      search,
      page = 1,
      limit = 25,
    } = req.query as any;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(5, Number(limit) || 25));
    const offset = (pageNum - 1) * limitNum;

    const { whereClause: dateWhereW, replacements } = buildDateConditions(startDate, endDate, "w");

    let extraFilter = "";

    if (operatorId && operatorId !== "ALL") {
      extraFilter += " AND w.operator_id = :operatorId";
      replacements.operatorId = String(operatorId);
    }
    if (defectReason && defectReason !== "ALL") {
      extraFilter += " AND r.repair_reason_name = :defectReason";
      replacements.defectReason = String(defectReason);
    }
    if (targetDept && targetDept !== "ALL") {
      if (targetDept === "DİĞER" || targetDept === "Diğer / Belirtilmemiş") {
        extraFilter += " AND (r.target_department IS NULL OR TRIM(r.target_department) = '')";
      } else {
        extraFilter += " AND UPPER(TRIM(r.target_department)) = :targetDept";
        replacements.targetDept = String(targetDept).toUpperCase();
      }
    }
    if (search && String(search).trim() !== "") {
      extraFilter += ` AND (
        w.order_no LIKE :search OR
        w.material_no LIKE :search OR
        r.repair_reason_name LIKE :search OR
        o.name LIKE :search OR
        o.surname LIKE :search
      )`;
      replacements.search = `%${String(search).trim()}%`;
    }

    replacements.limit = limitNum;
    replacements.offset = offset;

    // Toplam Kayıt Sayısı
    const [countRows]: any = await sequelize.query(
      `SELECT COUNT(r.id) as total_count
       FROM work_log_repairs r
       INNER JOIN work_logs w ON r.work_log_id = w.id
       LEFT JOIN operator_table o ON w.operator_id = o.id_dec
       WHERE w.area_name = 'kalite' AND w.status = 4 ${dateWhereW} ${extraFilter}`,
      { replacements, type: QueryTypes.SELECT }
    );

    const totalCount = Number(countRows?.total_count || 0);

    // Sayfalanmış Veriler
    const rows: any[] = await sequelize.query(
      `SELECT 
        r.id as repair_id,
        r.work_log_id,
        w.order_no,
        w.material_no,
        w.operator_id,
        ISNULL(NULLIF(TRIM(CONCAT(o.name, ' ', o.surname)), ''), CONCAT('Personel (', w.operator_id, ')')) as operator_name,
        r.repair_reason_id,
        r.repair_reason_name,
        ISNULL(ROUND(r.qty, 2), 0) as repair_qty_gr,
        CASE 
          WHEN r.target_department IS NULL OR TRIM(r.target_department) = '' THEN 'Diğer / Belirtilmemiş'
          WHEN UPPER(TRIM(r.target_department)) IN ('CİLA', 'CILA') THEN 'CİLA'
          ELSE UPPER(TRIM(r.target_department))
        END as target_department,
        ISNULL(ROUND(w.produced_qty_gr, 2), 0) as good_qty_gr,
        w.start_date,
        w.end_date,
        ISNULL(w.finish_description, '') as finish_description
       FROM work_log_repairs r
       INNER JOIN work_logs w ON r.work_log_id = w.id
       LEFT JOIN operator_table o ON w.operator_id = o.id_dec
       WHERE w.area_name = 'kalite' AND w.status = 4 ${dateWhereW} ${extraFilter}
       ORDER BY r.id DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { replacements, type: QueryTypes.SELECT }
    );

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalCount,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error("[QualityReportController] getQualityReportDetails Error:", error);
    return res.status(500).json({ success: false, message: "Kalite detay kayıtları çekilirken hata oluştu." });
  }
};
