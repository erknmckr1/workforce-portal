import { Request, Response } from "express";
import { SapOrder, MesProcess, MesRepairReason, MesStopReason, Status } from "../models";
import { WorkLog } from "../models/WorkLog";
import { WorkLogPause } from "../models/WorkLogPause";
import { Op } from "sequelize";

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
      return res.status(400).json({ message: "Bölüm (areaName) ve alt bölüm (section) gerekli." });
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
          status: { [Op.in]: [1, 2, 4] },
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
      return res.status(400).json({ message: "Sipariş ID'si ve Operatör ID'si gerekli." });
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
    return res
      .status(500)
      .json({
        message: "İş iptal edilirken sunucu tarafında bir hata oluştu.",
      });
  }
};

export const stopWork = async (req: Request, res: Response) => {
  try {
    const { workLogId, operatorId, stopReasonId } = req.body;
    
    if (!workLogId || !operatorId || !stopReasonId) {
      return res.status(400).json({ message: "Sipariş ID, Operatör ID ve Duruş Nedeni gerekli." });
    }

    const workLog = await WorkLog.findOne({
      where: {
        id: workLogId,
        status: 1, // Sadece aktif olan iş durdurulabilir
      },
    });

    if (!workLog) {
      return res.status(404).json({ message: "Durdurulacak aktif iş bulunamadı. (Sadece statüsü 'Başladı' olan işler durdurulabilir)" });
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
    const { areaName } = req.query;

    if (!areaName) {
      return res.status(400).json({ message: "Bölüm adı (areaName) gerekli." });
    }

    const workLogs = await WorkLog.findAll({
      where: {
        area_name: areaName as string,
        status: { [Op.in]: [1, 2] },
      },
      include: [{ model: Status, as: "StatusDetail" }],
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
      return res.status(400).json({ message: "Sipariş ID'si ve Operatör ID'si gerekli." });
    }
    const workLog = await WorkLog.findOne({
      where: {
        id: workLogId,
        status: 2,
      },
    });
    if (!workLog) {
      return res.status(404).json({ message: "Yeniden başlatılacak durdurulmuş iş bulunamadı." });
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

    return res.status(200).json({ message: "İş başarıyla yeniden başlatıldı." });
  } catch (error) {
    console.error("restartWork Error:", error);
    return res
      .status(500)
      .json({ message: "İş başlatılırken sunucu tarafında bir hata oluştu." });
  }
};

