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
import { Op, QueryTypes } from "sequelize";
import timecureSequelize from "../config/timecureDatabase";
import sapSequelize from "../config/mesDatabase";
import ExternalMovement from "../models/ExternalMovement";

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
    } = req.body;

    // 1. Gerekli Alanların Kontrolü
    if (!operator_id || !order_no || !area_name || !process_id) {
      return res.status(400).json({
        message:
          "Eksik bilgi gönderildi (operator_id, order_no, area_name, process_id zorunludur).",
      });
    }

    // 2. İş Kuralları (Business Rules)

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

    const workLogs = await WorkLog.findAll({
      where: {
        area_name: areaName as string,
        [Op.or]: [
          { status: 1, operator_id: operatorId as string }, // Sadece aktif kullanıcının devam eden işleri
          { status: { [Op.in]: [2, 9] } }, // Durdurulmuş veya mola nedeniyle bekleyen tüm işler
        ],
      },
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
    const workLog = await WorkLog.findOne({
      where: {
        id: workLogId,
        status: 2,
      },
    });
    if (!workLog) {
      return res
        .status(404)
        .json({ message: "Yeniden başlatılacak durdurulmuş iş bulunamadı." });
    }

    // Açık olan (henüz bitmemiş) son duruş kaydını bul ve kapat
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

    // Ana tablonun statüsünü tekrar Aktif (1) yapıyoruz ancak START_DATE EZİLMİYOR!
    await workLog.update({
      status: 1, // 1: Başladı (STARTED)
      operator_id: operatorId, // İşi devralan başka bir operatörse onu güncelle
    });

    return res
      .status(200)
      .json({ message: "İş başarıyla yeniden başlatıldı." });
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
