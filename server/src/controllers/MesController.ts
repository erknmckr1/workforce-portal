import { Request, Response } from "express";
import {
  SapOrder,
  MesProcess,
  MesRepairReason,
  MesStopReason,
  Status,
  Operator,
  Department,
} from "../models";
import { WorkLog } from "../models/WorkLog";
import { WorkLogPause } from "../models/WorkLogPause";
import { WorkLogRepair } from "../models/WorkLogRepair";
import { OperatorBreak } from "../models/OperatorBreak";
import ScrapMeasurement from "../models/ScrapMeasurement";
import { MesMachine } from "../models/MesMachine";
import { Measurement } from "../models/Measurement";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../config/database";
import timecureSequelize from "../config/timecureDatabase";
import sapSequelize from "../config/mesDatabase";
import ExternalMovement from "../models/ExternalMovement";
import fs from "fs";
import path from "path";

// Dosya listesi için basit bir cache yapısı
let fileCache: { files: string[]; lastUpdate: number } = {
  files: [],
  lastUpdate: 0,
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

export const isOperatorOnBreak = async (operator_id: string) => {
  const activeBreak = await OperatorBreak.findOne({
    where: {
      operator_id: operator_id,
      status: 1, // Aktif mola
      end_date: { [Op.is]: null },
    },
  });
  return !!activeBreak;
};

export const getSapOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params;

  try {
    const order = await SapOrder.findOne({
      where: {
        ORDER_ID: orderId,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Sipariş bulunamadı." });
    }

    return res.status(200).json(order);
  } catch (error: any) {
    console.error("SAP Sipariş sorgulama hatası:", error);
    return res
      .status(500)
      .json({ message: "Sipariş bilgileri çekilirken bir hata oluştu." });
  }
};

// Bölüme (area_name) göre proses listesini getir
export const getProcessesByArea = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { areaName } = req.query;

  try {
    if (!areaName) {
      return res.status(400).json({ message: "Bölüm adı (areaName) gerekli." });
    }

    const processes = await MesProcess.findAll({
      where: {
        area_name: areaName as string,
      },
      order: [["process_name", "ASC"]],
    });

    return res.status(200).json(processes);
  } catch (error) {
    console.error("getProcessesByArea Error:", error);
    return res
      .status(500)
      .json({ message: "Prosesler getirilirken bir hata oluştu." });
  }
};

// Bölüme (area_name) göre tamir nedenlerini getir
export const getRepairReasonsByArea = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  const { areaName, section } = req.query;

  try {
    if (!areaName || !section) {
      return res
        .status(400)
        .json({ message: "Bölüm (areaName) ve alt bölüm (section) gerekli." });
    }

    const reasons = await MesRepairReason.findAll({
      where: {
        area_name: areaName as string,
        section: section as string,
      },
    });

    return res.status(200).json(reasons);
  } catch (error) {
    console.error("Tamir nedenleri çekilirken hata:", error);
    return res
      .status(500)
      .json({ message: "Tamir nedenleri getirilirken bir hata oluştu." });
  }
};

// Bölüme (area_name) göre duruş (stop) nedenlerini getir
export const getStopReasonsByArea = async (req: Request, res: Response) => {
  const { areaName, section } = req.query;

  try {
    if (!areaName || !section) {
      return res
        .status(400)
        .json({ message: "Bölüm (areaName) ve alt bölüm (section) gerekli." });
    }

    const reasons = await MesStopReason.findAll({
      where: {
        area_name: areaName as string,
        section: section as string,
      },
    });

    return res.status(200).json(reasons);
  } catch (error) {
    console.error("Duruş nedenleri çekilirken hata:", error);
    return res
      .status(500)
      .json({ message: "Duruş nedenleri getirilirken bir hata oluştu." });
  }
};

export const startWork = async (req: Request, res: Response) => {
  try {
    const {
      operator_id,
      order_no,
      section_id,
      area_name,
      field,
      process_id,
      process_name,
      machine_name,
      material_no,
    } = req.body;

    // 1. Gerekli Alanların Kontrolü
    if (!operator_id || !order_no || !area_name || !process_id) {
      return res.status(400).json({
        message:
          "Eksik bilgi gönderildi (operator_id, order_no, area_name, process_id zorunludur).",
      });
    }

    // Operatör Geçerlilik Kontrolü
    const operator = await Operator.findOne({ where: { id_dec: operator_id } });
    if (!operator) {
      return res.status(404).json({
        message: `Geçersiz Operatör ID (${operator_id})! Lütfen sistemde kayıtlı bir ID giriniz.`,
      });
    }

    // 2. Mola Kontrolü
    const onBreak = await isOperatorOnBreak(operator_id);
    if (onBreak) {
      return res.status(403).json({
        message: "Moladayken iş başlatamazsınız. Lütfen önce molanızı bitirin.",
      });
    }

    // 3. İş Kuralları (Business Rules)

    // Kural A: Cila bölümünde aynı proseste zaten aktif bir iş var mı?
    if (area_name === "cila") {
      const activeCilaJob = await WorkLog.findOne({
        where: {
          area_name: "cila",
          process_id,
          operator_id,
          status: 1, // Sadece aktif olanları kontrol et
        },
      });
      if (activeCilaJob) {
        return res.status(400).json({
          message: "Cila bölümünde bu proseste zaten aktif bir işiniz var.",
        });
      }
    }

    // Kural B: Buzlama bölümü makine seçimi zorunludur ve aynı makinede aynı sipariş aktif olamaz
    if (area_name === "buzlama") {
      if (!machine_name) {
        return res
          .status(400)
          .json({ message: "Buzlama bölümünde makine seçimi zorunludur." });
      }
      const activeBuzlamaJob = await WorkLog.findOne({
        where: {
          area_name: "buzlama",
          machine_name,
          order_no,
          status: { [Op.in]: [1, 2] }, // Aktif veya Duraklatılmış
        },
      });
      if (activeBuzlamaJob) {
        return res.status(400).json({
          message: `${machine_name} makinesinde ${order_no} numaralı sipariş zaten başlatılmış.`,
        });
      }
    }

    // Kural C: Çekiç bölümünde makine alanındaysak, makinede başka aktif iş olmamalı
    if (area_name === "cekic" && field === "makine" && machine_name) {
      const activeMachineJob = await WorkLog.findOne({
        where: {
          area_name: "cekic",
          machine_name,
          status: { [Op.in]: [1, 2] },
        },
      });
      if (activeMachineJob) {
        return res.status(400).json({
          message: `${machine_name} makinesinde zaten başka bir aktif iş var.`,
        });
      }
    }

    if (area_name === "kalite") {
      const activeKaliteJob = await WorkLog.findOne({
        where: {
          order_no,
          status: { [Op.in]: [1, 2] },
        },
      });
      if (activeKaliteJob) {
        return res.status(400).json({
          message: `Bu siparişin(${order_no})  kontrolü zaten başlatılmış.`,
        });
      }
    }

    // 3. Yeni İşi Oluştur (work_logs tablosuna kayıt at)
    const newWork = await WorkLog.create({
      operator_id,
      order_no,
      section_id: section_id || null,
      area_name,
      field: field || null,
      process_id,
      process_name,
      machine_name: machine_name || null,
      material_no: material_no || null,
      status: 1, // 1: Başladı (STARTED)
      start_date: new Date(),
    });

    return res.status(201).json({
      message: "İş başarıyla başlatıldı.",
      data: newWork,
    });
  } catch (error) {
    console.error("startWork Error:", error);
    return res
      .status(500)
      .json({ message: "İş başlatılırken sunucu tarafında bir hata oluştu." });
  }
};

export const cancelWork = async (req: Request, res: Response) => {
  try {
    const { workLogId, operatorId, cancelReasonId } = req.body;
    if (!workLogId || !operatorId) {
      return res
        .status(400)
        .json({ message: "Sipariş ID'si ve Operatör ID'si gerekli." });
    }

    // Operatör Geçerlilik Kontrolü
    const operator = await Operator.findOne({ where: { id_dec: operatorId } });
    if (!operator) {
      return res.status(404).json({
        message: `Geçersiz Operatör ID (${operatorId})! Lütfen sistemde kayıtlı bir ID giriniz.`,
      });
    }

    // Mola Kontrolü
    if (await isOperatorOnBreak(operatorId)) {
      return res.status(403).json({
        message: "Moladayken işlem yapamazsınız. Lütfen önce molanızı bitirin.",
      });
    }
    const workLog = await WorkLog.findOne({
      where: {
        id: workLogId,
      },
    });
    if (!workLog) {
      return res.status(404).json({ message: "İş günlüğü bulunamadı." });
    }
    await workLog.update({
      status: 3, // 3: İptal edildi (CANCELLED)
      cancelled_by: operatorId,
      cancelled_at: new Date(),
      cancel_reason_id: cancelReasonId || null,
      end_date: new Date(), // İşi sonlandırdığı için end_date'i de atıyoruz
    });
    return res.status(200).json({ message: "İş başarıyla iptal edildi." });
  } catch (error) {
    console.error("cancelWork Error:", error);
    return res.status(500).json({
      message: "İş iptal edilirken sunucu tarafında bir hata oluştu.",
    });
  }
};

export const stopWork = async (req: Request, res: Response) => {
  try {
    const { workLogId, operatorId, stopReasonId } = req.body;

    if (!workLogId || !operatorId || !stopReasonId) {
      return res
        .status(400)
        .json({ message: "Sipariş ID, Operatör ID ve Duruş Nedeni gerekli." });
    }

    // Operatör Geçerlilik Kontrolü
    const operator = await Operator.findOne({ where: { id_dec: operatorId } });
    if (!operator) {
      return res.status(404).json({
        message: `Geçersiz Operatör ID (${operatorId})! Lütfen sistemde kayıtlı bir ID giriniz.`,
      });
    }

    // Mola Kontrolü
    if (await isOperatorOnBreak(operatorId)) {
      return res.status(403).json({
        message: "Moladayken işlem yapamazsınız. Lütfen önce molanızı bitirin.",
      });
    }

    const workLog = await WorkLog.findOne({
      where: {
        id: workLogId,
        status: 1, // Sadece aktif olan iş durdurulabilir
      },
    });

    if (!workLog) {
      return res.status(404).json({
        message:
          "Durdurulacak aktif iş bulunamadı. (Sadece statüsü 'Başladı' olan işler durdurulabilir)",
      });
    }

    // Duruş kaydını logluyoruz
    await WorkLogPause.create({
      work_log_id: workLog.id,
      stop_reason_id: stopReasonId,
      operator_id: operatorId,
      pause_start: new Date(),
    });

    await workLog.update({
      status: 2, // 2: Durdurulan (Mola/Arıza vs)
    });

    return res.status(200).json({ message: "İş başarıyla durduruldu." });
  } catch (error) {
    console.error("stopWork Error:", error);
    return res
      .status(500)
      .json({ message: "İş durdurulurken sunucu tarafında bir hata oluştu." });
  }
};

export const getWorkLogs = async (req: Request, res: Response) => {
  try {
    const { areaName, operatorId } = req.query;

    if (!areaName) {
      return res.status(400).json({ message: "Bölüm adı (areaName) gerekli." });
    }

    let whereCondition: any = {
      area_name: areaName as string,
    };

    if (areaName === "buzlama" || areaName === "kurutiras") {
      // Buzlama ve Kurutiras alanları ortak bir havuzdur, tüm aktif/durdurulmuş işleri gösterir
      whereCondition.status = { [Op.in]: [1, 2, 9] };
    } else {
      // Diğer alanlarda:
      // 1. Durdurulmuş (2) veya mola nedeniyle bekleyen (9) TÜM işler
      // 2. Sadece aktif kullanıcının (operatorId) devam eden (1) işleri
      const orConditions: any[] = [
        { status: { [Op.in]: [2, 9] } }
      ];

      if (operatorId && operatorId !== "undefined") {
        orConditions.push({ status: 1, operator_id: operatorId as string });
      }

      whereCondition[Op.or] = orConditions;
    }

    const workLogs = await WorkLog.findAll({
      where: whereCondition,
      include: [
        { model: Status, as: "StatusDetail" },
        { model: Operator, as: "Operator", attributes: ["name", "surname"] },
      ],
      order: [["start_date", "DESC"]],
    });

    return res.status(200).json(workLogs);
  } catch (error) {
    console.error("getWorkLogs Error:", error);
    return res
      .status(500)
      .json({ message: "İş günlükleri getirilirken bir hata oluştu." });
  }
};

export const restartWork = async (req: Request, res: Response) => {
  try {
    const { workLogId, operatorId } = req.body;
    if (!workLogId || !operatorId) {
      return res
        .status(400)
        .json({ message: "Sipariş ID'si ve Operatör ID'si gerekli." });
    }

    // Operatör Geçerlilik Kontrolü
    const operator = await Operator.findOne({ where: { id_dec: operatorId } });
    if (!operator) {
      return res.status(404).json({
        message: `Geçersiz Operatör ID (${operatorId})! Lütfen sistemde kayıtlı bir ID giriniz.`,
      });
    }

    // Mola Kontrolü
    if (await isOperatorOnBreak(operatorId)) {
      return res.status(403).json({
        message: "Moladayken iş başlatamazsınız. Lütfen önce molanızı bitirin.",
      });
    }

    const workLog = await WorkLog.findOne({
      where: {
        id: workLogId,
        status: { [Op.in]: [2, 9] }, // Hem durdurulmuş (2) hem de mola nedeniyle bekleyen (9) işler başlatılabilir
      },
    });

    if (!workLog) {
      return res
        .status(404)
        .json({ message: "Yeniden başlatılacak durdurulmuş iş bulunamadı." });
    }

    // --- DURUŞ KAYDINI KAPATMA (Ortak İşlem) ---
    const openPause = await WorkLogPause.findOne({
      where: {
        work_log_id: workLog.id,
        pause_end: null,
      },
      order: [["pause_start", "DESC"]],
    });

    if (openPause) {
      await openPause.update({ pause_end: new Date() });
    }

    // --- DEVİR KONTROLÜ VE İŞLEME ---
    if (String(workLog.operator_id) !== String(operatorId)) {
      // 1. Mevcut kaydı "Devredildi" (5) olarak kapat
      await workLog.update({
        status: 5, // 5: Devredildi (Handover)
        end_date: new Date(),
        finish_description: `${operatorId} kodlu operatöre devredildi.`,
      });

      // 2. Yeni Operatör için YENİ bir kayıt oluştur
      const newWork = await WorkLog.create({
        operator_id: operatorId,
        order_no: workLog.order_no,
        section_id: workLog.section_id,
        area_name: workLog.area_name,
        field: workLog.field,
        process_id: workLog.process_id,
        process_name: workLog.process_name,
        machine_name: workLog.machine_name,
        material_no: workLog.material_no,
        status: 1, // 1: Başladı
        start_date: new Date(),
      });

      return res.status(201).json({
        message: "İş devralındı ve yeni kayıt oluşturuldu.",
        data: newWork,
      });
    } else {
      // AYNI OPERATÖR DEVAM EDİYOR
      await workLog.update({
        status: 1, // 1: Başladı (STARTED)
      });

      return res
        .status(200)
        .json({ message: "İş başarıyla yeniden başlatıldı." });
    }
  } catch (error) {
    console.error("restartWork Error:", error);
    return res
      .status(500)
      .json({ message: "İş başlatılırken sunucu tarafında bir hata oluştu." });
  }
};

export const finishWork = async (req: Request, res: Response) => {
  const {
    operator_id,
    work_log_id,
    produced_qty_gr,
    finish_description,
    additional_data,
  } = req.body;

  if (!operator_id || !work_log_id) {
    return res.status(400).json({ message: "Operatör ve iş kaydı gerekli." });
  }

  // Operatör Geçerlilik Kontrolü
  const operator = await Operator.findOne({ where: { id_dec: operator_id } });
  if (!operator) {
    return res.status(404).json({
      message: `Geçersiz Operatör ID (${operator_id})! Lütfen sistemde kayıtlı bir ID giriniz.`,
    });
  }

  // Mola Kontrolü
  if (await isOperatorOnBreak(operator_id)) {
    return res.status(403).json({
      message: "Moladayken iş bitiremezsiniz. Lütfen önce molanızı bitirin.",
    });
  }

  try {
    const workLog = await WorkLog.findOne({
      where: {
        id: work_log_id,
        status: [1, 2], // Hem aktif hem de duraklatılmış işler bitirilebilmeli
      },
    });

    if (!workLog) {
      return res.status(404).json({
        message: "Bitirilecek aktif veya duraklatılmış iş kaydı bulunamadı.",
      });
    }

    await workLog.update({
      status: 4, // 4: Tamamlandı
      end_date: new Date(),
      produced_qty_gr,
      finish_description,
      additional_data,
    });

    // --- YENİ: Tamir Detaylarını Ayrı Tabloya Kaydet ---
    if (
      additional_data?.repair_details &&
      Array.isArray(additional_data.repair_details)
    ) {
      const repairRows = additional_data.repair_details.map((repair: any) => ({
        work_log_id: workLog.id,
        repair_reason_id: repair.reasonId,
        repair_reason_name: repair.reasonName,
        qty: repair.qty,
        target_department: additional_data.target_department || null,
      }));

      if (repairRows.length > 0) {
        await WorkLogRepair.bulkCreate(repairRows);
      }
    }
    // --------------------------------------------------

    return res.status(200).json({ message: "İş başarıyla tamamlandı." });
  } catch (error) {
    console.error("finishWork Error:", error);
    return res.status(500).json({
      message: "İş sonlandırılırken sunucu tarafında bir hata oluştu.",
    });
  }
};

export const startBreak = async (req: Request, res: Response) => {
  try {
    const { operator_id, break_reason, area_name } = req.body;

    if (!operator_id || !break_reason) {
      return res
        .status(400)
        .json({ message: "Operatör ve mola nedeni gerekli." });
    }

    // Operatör Geçerlilik Kontrolü
    const operator = await Operator.findOne({ where: { id_dec: operator_id } });
    if (!operator) {
      return res.status(404).json({
        message: `Geçersiz Operatör ID (${operator_id})! Lütfen sistemde kayıtlı bir ID giriniz.`,
      });
    }

    // 1. Aktif bir mola var mı kontrol et
    const activeBreak = await OperatorBreak.findOne({
      where: { operator_id, status: 1 },
    });

    if (activeBreak) {
      return res
        .status(400)
        .json({ message: "Zaten aktif bir molanız bulunuyor." });
    }

    // 2. Molayı başlat
    const newBreak = await OperatorBreak.create({
      operator_id,
      break_reason,
      area_name, // Terminal bilgisi eklendi
      start_date: new Date(),
      status: 1,
    });

    // 3. Operatörün aktif (status=1) işlerini bul ve durumunu 9 (Mola) yap
    const activeWorkLogs = await WorkLog.findAll({
      where: {
        operator_id,
        status: 1,
      },
    });

    for (const log of activeWorkLogs) {
      // Her bir iş için otomatik duruş kaydı oluştur
      await WorkLogPause.create({
        work_log_id: log.id,
        stop_reason_id: "MOLA",
        operator_id,
        pause_start: new Date(),
      });

      await log.update({ status: 9 });
    }

    return res.status(200).json({
      message: "Mola başlatıldı ve aktif işleriniz duraklatıldı.",
      data: newBreak,
    });
  } catch (error) {
    console.error("startBreak Error:", error);
    return res.status(500).json({ message: "Mola başlatılırken hata oluştu." });
  }
};

export const endBreak = async (req: Request, res: Response) => {
  try {
    const { operator_id } = req.body;

    if (!operator_id) {
      return res.status(400).json({ message: "Operatör ID gerekli." });
    }

    const activeBreak = await OperatorBreak.findOne({
      where: { operator_id, status: 1 },
    });

    if (!activeBreak) {
      return res.status(400).json({ message: "Aktif mola kaydı bulunamadı." });
    }

    // 1. Molayı bitir
    await activeBreak.update({
      end_date: new Date(),
      status: 2, // Tamamlandı
    });

    // 2. Mola nedeniyle duran (status=9) işleri bul ve geri başlat
    const pausedWorkLogs = await WorkLog.findAll({
      where: {
        operator_id,
        status: 9,
      },
    });

    for (const log of pausedWorkLogs) {
      // Açık mola duruş kaydını kapat
      const openPause = await WorkLogPause.findOne({
        where: { work_log_id: log.id, pause_end: null },
        order: [["pause_start", "DESC"]],
      });

      if (openPause) {
        await openPause.update({ pause_end: new Date() });
      }

      await log.update({ status: 1 });
    }

    return res.status(200).json({
      message: "Mola bitti ve işleriniz kaldığı yerden devam ediyor.",
    });
  } catch (error) {
    console.error("endBreak Error:", error);
    return res.status(500).json({ message: "Moladan dönerken hata oluştu." });
  }
};

export const getActiveBreaks = async (req: Request, res: Response) => {
  try {
    const { areaName } = req.query;

    const activeBreaks = await OperatorBreak.findAll({
      where: {
        status: 1,
        ...(areaName && { area_name: String(areaName) }), // Doğrudan area_name üzerinden filtrele
      },
      include: [
        {
          model: Operator,
          as: "Operator",
          attributes: ["name", "surname", "id_dec"],
        },
      ],
      order: [["start_date", "DESC"]],
    });

    return res.status(200).json(activeBreaks);
  } catch (error) {
    console.error("getActiveBreaks Error:", error);
    return res
      .status(500)
      .json({ message: "Mola verileri çekilirken hata oluştu." });
  }
};

export const getFactoryEntryTime = async (req: Request, res: Response) => {
  try {
    const { externalId } = req.query;

    if (!externalId) {
      return res.status(200).json({ entryTime: null });
    }

    const todayStart = new Date().setHours(0, 0, 0, 0);

    // 1. Bugünkü en son giriş
    const lastEntry = await ExternalMovement.findOne({
      where: {
        KisiId: externalId,
        KabulGirisCikis: 1,
        Zaman: { [Op.gte]: todayStart },
      },
      order: [["Zaman", "DESC"]],
      attributes: ["Zaman"],
    });

    // 2. Bir önceki günün en son çıkışı (Bugünden küçük olan en son çıkış)
    const lastExit = await ExternalMovement.findOne({
      where: {
        KisiId: externalId,
        KabulGirisCikis: 2,
        Zaman: { [Op.lt]: todayStart },
      },
      order: [["Zaman", "DESC"]],
      attributes: ["Zaman"],
    });

    return res.status(200).json({
      entryTime: lastEntry ? lastEntry.Zaman : null,
      exitTime: lastExit ? lastExit.Zaman : null,
    });
  } catch (error) {
    console.error("getFactoryEntryTime Error:", error);
    return res
      .status(500)
      .json({ message: "Giriş saati alınırken hata oluştu." });
  }
};

export const getProductFile = async (req: Request, res: Response) => {
  const { materialNo } = req.params;
  const BASE_PATH =
    process.env.PRODUCT_IMAGES_PATH ||
    "\\\\192.168.1.40\\montaj resimler\\Fason Resimleri";

  if (!materialNo) {
    return res.status(400).json({ message: "Malzeme numarası gerekli." });
  }

  try {
    const now = Date.now();
    let files = fileCache.files;

    // Cache kontrolü veya yenileme
    if (now - fileCache.lastUpdate > CACHE_DURATION) {
      if (fs.existsSync(BASE_PATH)) {
        files = fs.readdirSync(BASE_PATH);
        fileCache = { files, lastUpdate: now };
      } else {
        console.warn("Resim klasörüne erişilemiyor:", BASE_PATH);
        // Eğer klasöre erişilemiyorsa ama cache varsa eskiyi kullan, yoksa hata ver
        if (files.length === 0) {
          return res
            .status(500)
            .json({ message: "Resim sunucusuna erişilemedi." });
        }
      }
    }

    const searchKey = String(materialNo).trim().toLowerCase();

    // Dosya listesi içinde ara
    const foundFileName = files.find((file) => {
      const fileNameLower = file.toLowerCase();
      const hasExtension = [".jpg", ".jpeg", ".png", ".pdf"].some((ext) =>
        fileNameLower.endsWith(ext),
      );
      // Tam eşleşme veya malzeme numarasını içeren ilk dosyayı bul
      return fileNameLower.includes(searchKey) && hasExtension;
    });

    if (!foundFileName) {
      return res.status(404).json({ message: "Görsel bulunamadı." });
    }

    const fullPath = path.join(BASE_PATH, foundFileName);
    return res.sendFile(fullPath);
  } catch (error) {
    console.error("getProductFile Error:", error);
    return res
      .status(500)
      .json({ message: "Dosya sunucusunda bir hata oluştu." });
  }
};

// Personel Giriş-Çıkış Analiz Raporu
export const getPersonnelMovementReport = async (
  req: Request,
  res: Response,
) => {
  const { operatorId, startDate, endDate } = req.query;

  try {
    if (!operatorId || !startDate || !endDate) {
      return res.status(400).json({
        message: "Operator ID, başlangıç ve bitiş tarihleri gereklidir.",
      });
    }

    const start = new Date(startDate as string);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);

    // 1. Önce operatörü bulup external_id'sini (Timecure ID) alalım
    const operator = await Operator.findOne({
      where: { id_dec: operatorId as string },
      attributes: ["external_id"],
    });

    if (!operator || !operator.external_id) {
      return res
        .status(404)
        .json({ message: "Operatörün Timecure ID'si bulunamadı." });
    }

    // 2. Ham verileri çek (Timecure ID ile)
    const movements = await ExternalMovement.findAll({
      where: {
        KisiId: operator.external_id,
        Zaman: {
          [Op.between]: [start, end],
        },
      },
      order: [["Zaman", "ASC"]],
    });

    // Gün bazlı gruplandırma
    const reportData: { [key: string]: any } = {};

    movements.forEach((mov: any) => {
      const dateKey = mov.Zaman.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!reportData[dateKey]) {
        reportData[dateKey] = {
          date: dateKey,
          firstEntry: null,
          lastExit: null,
          totalHours: 0,
          movements: [],
        };
      }

      // KabulGirisCikis 1: Giriş, 2: Çıkış
      if (
        mov.KabulGirisCikis === 1 &&
        (!reportData[dateKey].firstEntry ||
          mov.Zaman < reportData[dateKey].firstEntry)
      ) {
        reportData[dateKey].firstEntry = mov.Zaman;
      }

      if (
        mov.KabulGirisCikis === 2 &&
        (!reportData[dateKey].lastExit ||
          mov.Zaman > reportData[dateKey].lastExit)
      ) {
        reportData[dateKey].lastExit = mov.Zaman;
      }

      reportData[dateKey].movements.push({
        time: mov.Zaman,
        type: mov.KabulGirisCikis,
      });
    });

    // Saat hesaplama
    const finalReport = Object.values(reportData).map((day: any) => {
      let hours = 0;
      if (day.firstEntry && day.lastExit && day.lastExit > day.firstEntry) {
        const diffMs = day.lastExit.getTime() - day.firstEntry.getTime();
        hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // 2 ondalıklı saat
      }

      return {
        ...day,
        totalHours: hours,
      };
    });

    return res.status(200).json(finalReport);
  } catch (error) {
    console.error("getPersonnelMovementReport Error:", error);
    return res
      .status(500)
      .json({ message: "Rapor verileri çekilirken bir hata oluştu." });
  }
};

/**
 * Günlük Geç Kalanlar Raporu (Toplu)
 * Belirli bir tarihte (varsayılan bugün) 07:45'ten sonra gelenleri listeler
 */
export const getLateArrivals = async (req: Request, res: Response) => {
  try {
    const { date, threshold } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    const thresholdTime = (threshold as string) || "07:45";

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Tüm personellerin o günkü ilk girişlerini bulalım
    // Group By ile her personelin o günkü MIN(Zaman) bilgisini alıyoruz
    const lateArrivalsRaw = await ExternalMovement.findAll({
      attributes: [
        "KisiId",
        [
          timecureSequelize.fn("MIN", timecureSequelize.col("Zaman")),
          "firstEntry",
        ],
      ],
      where: {
        Zaman: {
          [Op.between]: [startOfDay, endOfDay],
        },
        KabulGirisCikis: 1, // Sadece Giriş hareketlerini baz al
      },
      group: ["KisiId"],
      raw: true,
    });

    // 2. 07:45'ten sonra olanları filtrele (UTC bazlı kesin karşılaştırma)
    const [tH, tM] = thresholdTime.split(":").map(Number);
    const thresholdInMinutes = tH * 60 + tM;

    const lateFiltered = lateArrivalsRaw.filter((arrival: any) => {
      const entryDate = new Date(arrival.firstEntry);
      // UTC saat ve dakikasını alıp dakikaya çeviriyoruz
      const entryInMinutes =
        entryDate.getUTCHours() * 60 + entryDate.getUTCMinutes();

      return entryInMinutes > thresholdInMinutes;
    });

    if (lateFiltered.length === 0) {
      return res.json([]);
    }

    // 3. Operatör bilgilerini çek
    const kisiIds = lateFiltered.map((l: any) => l.KisiId);
    const operators = await Operator.findAll({
      where: {
        external_id: { [Op.in]: kisiIds },
      },
      attributes: ["id_dec", "name", "surname", "external_id"],
      include: [{ model: Department, attributes: ["name"] }],
    });

    // 4. Verileri birleştir
    const report = lateFiltered.map((arrival: any) => {
      const op = operators.find((o) => o.external_id === arrival.KisiId);
      return {
        operatorId: op?.id_dec || "Bilinmiyor",
        name: op ? `${op.name} ${op.surname}` : `ID: ${arrival.KisiId}`,
        department: op?.Department?.name || "---",
        firstEntry: arrival.firstEntry,
      };
    });

    return res.json(report);
  } catch (error: any) {
    console.error("Geç kalanlar raporu hatası:", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * FIRE (SCRAP) MEASUREMENT ENDPOINTS
 */

export const getScrapMeasurements = async (req: Request, res: Response) => {
  const { order_no } = req.query;

  if (!order_no) {
    return res.status(400).json({ message: "Sipariş numarası gerekli." });
  }

  try {
    const measurements = await ScrapMeasurement.findAll({
      where: { order_no: String(order_no) },
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(measurements);
  } catch (error) {
    console.error("getScrapMeasurements Error:", error);
    return res.status(500).json({ message: "Ölçüm verileri çekilemedi." });
  }
};

export const submitScrapMeasurement = async (req: Request, res: Response) => {
  const { formState, user_id, areaName } = req.body;

  try {
    // Operatör Geçerlilik Kontrolü
    const operator = await Operator.findOne({ where: { id_dec: user_id } });
    if (!operator) {
      return res.status(404).json({
        message: `Geçersiz Operatör ID (${user_id})! Lütfen sistemde kayıtlı bir ID giriniz.`,
      });
    }

    const newMeasurement = await ScrapMeasurement.create({
      order_no: formState.orderId,
      operator_id: user_id,
      area_name: areaName,
      entry_measurement: parseFloat(formState.entryGramage) || 0,
      exit_measurement: parseFloat(formState.exitGramage) || 0,
      gold_setting: parseFloat(formState.goldSetting) || 0,
      gold_pure_scrap: parseFloat(formState.gold_pure_scrap) || 0,
      measurement_diff: parseFloat(formState.diffirence) || 0,
    });

    return res.status(200).json(newMeasurement);
  } catch (error) {
    console.error("submitScrapMeasurement Error:", error);
    return res.status(500).json({ message: "Ölçüm kaydedilemedi." });
  }
};

export const updateScrapMeasurement = async (req: Request, res: Response) => {
  const { formState, id } = req.body;

  try {
    const measurement = await ScrapMeasurement.findByPk(id);
    if (!measurement) {
      return res
        .status(404)
        .json({ message: "Güncellenecek kayıt bulunamadı." });
    }

    await measurement.update({
      entry_measurement: parseFloat(formState.entryGramage) || 0,
      exit_measurement: parseFloat(formState.exitGramage) || 0,
      gold_setting: parseFloat(formState.goldSetting) || 0,
      gold_pure_scrap: parseFloat(formState.gold_pure_scrap) || 0,
      measurement_diff: parseFloat(formState.diffirence) || 0,
    });

    return res.status(200).json({ message: "Kayıt güncellendi." });
  } catch (error) {
    console.error("updateScrapMeasurement Error:", error);
    return res.status(500).json({ message: "Güncelleme yapılamadı." });
  }
};

// ==========================================
// MAKİNE ve ÖLÇÜM (MEASUREMENT) METOTLARI
// ==========================================

export const getMachines = async (req: Request, res: Response) => {
  try {
    const { area_name } = req.query;

    const whereClause: any = {};
    if (area_name) {
      whereClause.area_name = area_name;
    }

    const machines = await MesMachine.findAll({
      where: whereClause,
      order: [["machine_name", "ASC"]],
    });

    res.json(machines);
  } catch (error) {
    console.error("Makine listesi getirilirken hata:", error);
    res.status(500).json({ message: "Sunucu hatası." });
  }
};

export const getMeasurements = async (req: Request, res: Response) => {
  try {
    const { area_name, material_no } = req.query;

    if (!area_name || !material_no) {
      return res.status(400).json({ message: "Eksik parametre." });
    }

    const measurements = await Measurement.findAll({
      where: { area_name, material_no },
      order: [["createdAt", "DESC"]],
    });

    res.json(measurements);
  } catch (error) {
    console.error("Ölçüm verileri getirilirken hata:", error);
    res.status(500).json({ message: "Sunucu hatası." });
  }
};

export const saveMeasurement = async (req: Request, res: Response) => {
  try {
    const {
      order_no,
      material_no,
      operator,
      area_name,
      entry_measurement,
      exit_measurement,
      entry_weight_50cm,
      exit_weight_50cm,
      description,
      measurement_package,
    } = req.body;

    // Operatör Geçerlilik Kontrolü
    const operatorCheck = await Operator.findOne({
      where: { id_dec: operator },
    });
    if (!operatorCheck) {
      return res.status(404).json({
        message: `Geçersiz Operatör ID (${operator})! Lütfen sistemde kayıtlı bir ID giriniz.`,
      });
    }

    const newMeasurement = await Measurement.create({
      order_no,
      material_no,
      operator,
      area_name,
      entry_measurement,
      exit_measurement,
      entry_weight_50cm,
      exit_weight_50cm,
      description,
      measurement_package,
      data_entry_date: new Date(),
    });

    res.json(newMeasurement);
  } catch (error) {
    console.error("Ölçüm verisi kaydedilirken hata:", error);
    res.status(500).json({ message: "Sunucu hatası." });
  }
};

export const deleteMeasurement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const measurement = await Measurement.findByPk(id as string);
    if (!measurement) {
      return res.status(404).json({ message: "Ölçüm bulunamadı." });
    }

    await measurement.destroy();
    res.json({ message: "Ölçüm başarıyla silindi." });
  } catch (error) {
    console.error("Ölçüm verisi silinirken hata:", error);
    res.status(500).json({ message: "Sunucu hatası." });
  }
};

export const getMeasureLimits = async (req: Request, res: Response) => {
  try {
    const { materialNo } = req.params;

    const [results] = await sequelize.query(
      `
      SELECT lowerLimit, upperLimit, weight_50cm 
      FROM mes.dbo.zincir_50cm_gr 
      WHERE materialCode = :materialNo
    `,
      {
        replacements: { materialNo },
      },
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Limit bulunamadı." });
    }

    // İlk sonucu döndürüyoruz
    res.json(results[0]);
  } catch (error) {
    console.error("Limit getirilirken hata:", error);
    res.status(500).json({ message: "Sunucu hatası." });
  }
};

export const getOperatorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const operator = await Operator.findOne({
      where: { id_dec: id },
      attributes: ["id_dec", "name", "surname", "photo_url"],
    });

    if (!operator) {
      return res.status(404).json({ message: "Operatör bulunamadı." });
    }

    const isOnBreak = await isOperatorOnBreak(id as string);

    return res.status(200).json({
      ...operator.toJSON(),
      isOnBreak,
    });
  } catch (error) {
    console.error("getOperatorById Error:", error);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
};
