import { Request, Response } from "express";
import {
  LeaveRecord,
  LeaveStatus,
  LeaveReason,
  LeaveDurationType,
  Operator,
  Section,
  Department,
  LeaveActivityLog,
  Notification,
} from "../models";
import { Op, fn } from "sequelize";
import sequelize from "../config/database";
import { sendLeaveApprovalEmailAndLog } from "../services/leaveEmailNotificationService";
import { writeAuditLog } from "../services/auditService";
import jwt from "jsonwebtoken";

interface EmailActionPayload {
  leave_id: number;
  approver_id: string;
  action: "approve" | "reject";
}

// İzin için gerekli lookup verilerini getir
export const getLeaveLookups = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    let reasons = await LeaveReason.findAll({ where: { is_active: true } });
    let statuses = await LeaveStatus.findAll();
    let durationTypes = await LeaveDurationType.findAll();

    if (reasons.length === 0) {
      // Fail-safe seeding for dev environment
      await LeaveStatus.bulkCreate(
        [
          { id: 1, code: "PENDING_AUTH1", label: "1. Onaycı Bekleniyor" },
          { id: 2, code: "PENDING_AUTH2", label: "2. Onaycı Bekleniyor" },
          { id: 3, code: "APPROVED", label: "Onaylandı" },
          { id: 4, code: "CANCELLED", label: "İptal Edildi" },
          { id: 5, code: "REJECTED", label: "Reddedildi" },
        ],
        { ignoreDuplicates: true },
      );

      await LeaveDurationType.bulkCreate(
        [
          { id: 1, code: "FULL_DAY", label: "Tam Gün", deduction_factor: 1.0 },
          {
            id: 2,
            code: "HALF_DAY_AM",
            label: "Yarım Gün (Sabah)",
            deduction_factor: 0.5,
          },
          {
            id: 3,
            code: "HALF_DAY_PM",
            label: "Yarım Gün (Öğleden Sonra)",
            deduction_factor: 0.5,
          },
          {
            id: 4,
            code: "HOURLY",
            label: "Saatlik İzin",
            deduction_factor: 0.0,
          },
        ],
        { ignoreDuplicates: true },
      );

      await LeaveReason.bulkCreate(
        [
          {
            id: 1,
            code: "ANNUAL",
            label: "Yıllık İzin",
            required_permission: null,
          },
          {
            id: 2,
            code: "EXCUSE",
            label: "Mazeret İzni",
            required_permission: null,
          },
          {
            id: 3,
            code: "REST",
            label: "İstirahat Raporu",
            required_permission: "leave.view_doctor_reasons",
          },
          {
            id: 4,
            code: "DOCTOR",
            label: "Doktor Sevk",
            required_permission: "leave.view_doctor_reasons",
          },
          {
            id: 5,
            code: "PATERNITY",
            label: "Babalık İzni",
            required_permission: null,
          },
          {
            id: 6,
            code: "MARRIAGE",
            label: "Evlilik İzni",
            required_permission: null,
          },
          {
            id: 7,
            code: "BEREAVEMENT",
            label: "Vefat İzni",
            required_permission: null,
          },
          {
            id: 8,
            code: "DOCTOR_S",
            label: "Doktor Sevk",
            required_permission: null,
          },
          {
            id: 9,
            code: "DOCTOR_I",
            label: "Doktor İstirahat",
            required_permission: null,
          },
        ],
        { ignoreDuplicates: true },
      );

      reasons = await LeaveReason.findAll({ where: { is_active: true } });
      statuses = await LeaveStatus.findAll();
      durationTypes = await LeaveDurationType.findAll();
    }

    return res.status(200).json({
      reasons,
      statuses,
      durationTypes,
    });
  } catch (error) {
    console.error("GetLeaveLookups Hatası:", error);
    return res
      .status(500)
      .json({ message: "İzin yardımcı verileri çekilirken hata oluştu." });
  }
};

// Yeni İzin Talebi Oluştur
export const createLeave = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const transaction = await sequelize.transaction();
  try {
    const {
      user_id,
      leave_reason_id,
      leave_duration_type_id,
      start_date,
      end_date,
      description,
      phone,
      address,
      total_days,
      total_hours,
    } = req.body;

    const loggedUser = (req as any).user;
    
    // İşlemi yapan kullanıcı ID'si (Auth middleware'den gelmeli, şimdilik body'den veya manuel)
    const creator_id = loggedUser?.id_dec || req.body.creator_id || user_id;

    // 1. Hedef kullanıcının onaycılarını bul
    const targetUser = await Operator.findByPk(user_id);
    if (!targetUser) {
      await transaction.rollback();
      return res.status(404).json({ message: "Personel bulunamadı." });
    }

    const auth1 = targetUser.auth1;
    const auth2 = targetUser.auth2;

    const isAuthorizedForAutoApprove =
      loggedUser?.role_id === 7 ||
      loggedUser?.role_id === 4 ||
      loggedUser?.role_id === 5; // Admin, İK, Revir
    const shouldAutoApprove =
      (req.body.status === "Approved" || req.body.is_revir === true) &&
      isAuthorizedForAutoApprove;
    const hasNoApprovalChain = !auth1 && !auth2;
    const shouldApproveWithoutChain = !shouldAutoApprove && hasNoApprovalChain;
    const isApprovedOnCreate = shouldAutoApprove || shouldApproveWithoutChain;

    // Revir kaydı değilse ve Yönetici atanmamışsa hata ver
    if (!isApprovedOnCreate && !auth1) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "Seçili personelin 1. onaycısı (Birim Yöneticisi) atanmamış. Lütfen önce onay hiyerarşisini düzenleyin.",
      });
    }

    // ÇAKIŞMA KONTROLÜ (Overlap Check) - Aynı personelin çakışan aktif/bekleyen izni var mı?
    const overlappingLeave = await LeaveRecord.findOne({
      where: {
        user_id,
        leave_status_id: { [Op.notIn]: [4, 5] },
        [Op.or]: [
          {
            start_date: { [Op.lte]: end_date },
            end_date: { [Op.gte]: start_date },
          },
        ],
      },
      transaction,
    });

    if (overlappingLeave) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "Bu tarih aralığında zaten devam eden veya onay bekleyen bir izin talebiniz mevcut.",
      });
    }

    // 2. İlk durumu belirle (Revir/Admin veya onay zinciri yoksa direkt Onaylı=3, değilse Bekleyen=1)
    const initialStatus = isApprovedOnCreate ? 3 : 1;

    // 3. Kaydı oluştur
    const newLeave = await LeaveRecord.create(
      {
        user_id,
        leave_reason_id,
        leave_status_id: initialStatus,
        leave_duration_type_id: leave_duration_type_id || 4,
        auth1_user_id: shouldAutoApprove ? creator_id : auth1 || null,
        auth2_user_id: shouldAutoApprove ? null : auth2 || null,
        auth1_responded_at: shouldAutoApprove ? new Date() : undefined,
        auth2_responded_at: undefined,
        start_date,
        end_date,
        total_days: total_days || null,
        total_hours: total_hours || null,
        description: description || null,
        phone: phone || null,
        address: address || null,
        created_by: creator_id,
      },
      { transaction },
    );

    // 4. Aktivite logu yaz
    let actionEnum = "CREATED";
    if (shouldAutoApprove) actionEnum = "CREATED_BY_REVIR";
    else if (shouldApproveWithoutChain) actionEnum = "APPROVED";
    else if (creator_id !== user_id) actionEnum = "CREATED_BY_HR";

    await LeaveActivityLog.create(
      {
        leave_record_id: (newLeave as any).id,
        performed_by: creator_id,
        action: actionEnum,
        new_status_id: initialStatus,
        details: shouldAutoApprove
          ? "Revir tarafından doğrudan onaylı kayıt oluşturuldu."
          : shouldApproveWithoutChain
            ? "Onay zinciri bulunmadığı için izin talebi otomatik onaylandı."
            : "İzin talebi oluşturuldu.",
      },
      { transaction },
    );

    // --- BİLDİRİM TETİKLE ---
    if (!shouldAutoApprove && auth1) {
      // Normal İzin: Onaycıya bildir
      await Notification.create(
        {
          user_id: auth1,
          title: "Yeni İzin Talebi",
          message: `${targetUser.name} ${targetUser.surname} bir izin talebi oluşturdu. Onayınız bekleniyor.`,
          type: "LEAVE_REQUEST",
          related_id: (newLeave as any).id,
        },
        { transaction },
      );

      // E-Posta Gönderimi
      try {
        const reasonDoc = await LeaveReason.findByPk(leave_reason_id, {
          transaction,
        });
        await sendLeaveApprovalEmailAndLog({
          leaveId: (newLeave as any).id,
          performedBy: creator_id,
          recipientUserId: auth1,
          employeeName: `${targetUser.name} ${targetUser.surname}`,
          startDate: start_date,
          endDate: end_date,
          reason: reasonDoc ? reasonDoc.getDataValue("label") : "İzin",
          approvalStage: 1,
          transaction,
        });
      } catch (mailError) {
        console.error("1. Onaycıya e-posta gönderilemedi:", mailError);
      }
    } else if (shouldAutoApprove || shouldApproveWithoutChain) {
      // Revir/Admin veya onay zinciri olmayan izin: Personele bildir (Zaten onaylı)
      await Notification.create(
        {
          user_id: user_id,
          title: shouldApproveWithoutChain ? "İzniniz Otomatik Onaylandı" : "Revir İzni Oluşturuldu",
          message: shouldApproveWithoutChain
            ? "Onay zinciriniz bulunmadığı için izin talebiniz otomatik olarak onaylandı."
            : `Revir tarafından adınıza ${req.body.leave_type || "doktor sevk/istirahat"} izni oluşturulmuştur.`,
          type: "APPROVED",
          related_id: (newLeave as any).id,
        },
        { transaction },
      );
    }

    await transaction.commit();
    return res
      .status(201)
      .json({ message: "İzin talebi başarıyla oluşturuldu.", data: newLeave });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("CreateLeave Hatası:", error);
    return res
      .status(500)
      .json({ message: "İzin talebi oluşturulurken hata oluştu." });
  }
};

// İzinleri Listele (Filtreleme ile)
export const getLeaves = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      status_id,
      approver_id,
      start_date,
      end_date,
      search,
      leave_reasons,
      page = 1,
      limit = 10,
      is_security,
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    // BİLET KONTROLÜNDEN GEÇEN SİTE KULLANICISININ KİMLİĞİ BURADA
    const loggedUser = (req as any).user;
    const roleId = loggedUser?.role_id;
    const userId = loggedUser?.id_dec;

    let where: any = {};
    const isHistory = req.query.is_history === "true";
    const queryUserId = (req.query.user_id || req.query.personnel_id) as string;
    const queryApproverId = req.query.approver_id as string;

    // 0. KİOSK/IFRAME SENARYOSU (Giriş Yapmamış Kullanıcı)
    if (!loggedUser) {
      if (queryUserId) {
        where.user_id = queryUserId;
        if (status_id) where.leave_status_id = status_id;
      } else if (queryApproverId) {
        // Kiosk üzerinden onay bekleyenleri veya geçmişini gör
        if (isHistory) {
          where.leave_status_id = { [Op.in]: [3, 4, 5] };
          where[Op.or] = [
            { auth1_user_id: queryApproverId },
            { auth2_user_id: queryApproverId },
          ];
        } else {
          // Bekleyenler (Sıra kimdeyse o görür)
          where[Op.or] = [
            {
              [Op.and]: [
                { auth1_user_id: queryApproverId },
                { leave_status_id: 1 },
              ],
            },
            {
              [Op.and]: [
                { auth2_user_id: queryApproverId },
                { leave_status_id: 2 },
              ],
            },
          ];
        }
      }
    }
    // GÜVENLİK ÖNCELİKLİ GÖRÜNÜM: (is_security bayrağı gelmişse veya rolü güvenlikse)
    else if (is_security === "true" || roleId === 6) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      where[Op.and] = [
        { leave_status_id: 3 },
        {
          start_date: {
            [Op.between]: [todayStart, todayEnd],
          },
        },
      ];
    }
    // 1. Senaryo (Admin-7, İK-4, Revir-5) => Geniş Erişim Yetkisi
    else if (roleId === 7 || roleId === 4 || roleId === 5) {
      if (queryUserId) {
        where.user_id = queryUserId;
      }

      if (status_id) {
        where.leave_status_id = status_id;
      } else if (approver_id) {
        if (isHistory) {
          where.leave_status_id = { [Op.in]: [3, 4, 5] };
        } else {
          where.leave_status_id = { [Op.in]: [1, 2] };
        }
      }
    }
    // 2 & 3. Senaryolar (Müdür-3, Yönetici-2, Personel-1 vb.) => Onay Odaklı ve Sahiplik Odaklı Dinamik Filtreleme
    else if (loggedUser) {
      if (queryUserId === userId) {
        // Sadece kendi izinlerim sayfası
        where.user_id = userId;
        if (status_id) where.leave_status_id = status_id;
      } else if (approver_id) {
        // ONAY SAYFASI: Rol bağımsız, hiyerarşi ve kademe odaklı filtre
        if (isHistory) {
          where[Op.or] = [
            {
              [Op.and]: [
                { auth1_user_id: userId },
                { leave_status_id: { [Op.gt]: 1 } },
              ],
            },
            {
              [Op.and]: [
                { auth2_user_id: userId },
                { leave_status_id: { [Op.in]: [3, 4, 5] } },
              ],
            },
          ];
        } else {
          where[Op.or] = [
            { [Op.and]: [{ auth1_user_id: userId }, { leave_status_id: 1 }] },
            { [Op.and]: [{ auth2_user_id: userId }, { leave_status_id: 2 }] },
          ];
        }
      } else {
        // Genel/Dashboard görünümü: Sahibi veya herhangi bir aşamada onaycısı olduğu tüm izinler
        where[Op.or] = [
          { user_id: userId },
          { auth1_user_id: userId },
          { auth2_user_id: userId },
        ];
        if (status_id) where.leave_status_id = status_id;
      }
    }

    if (leave_reasons) {
      where.leave_reason_id = {
        [Op.in]: String(leave_reasons).split(",").map(Number),
      };
    }

    // Veritabanı Sorgusu (Sayfalamalı ve Sayımlı)
    if (start_date || end_date) {
      const dateFilter: any = {};

      if (start_date) {
        const [year, month, day] = String(start_date).split("-").map(Number);
        dateFilter[Op.gte] = new Date(year, month - 1, day, 0, 0, 0, 0);
      }

      if (end_date) {
        const [year, month, day] = String(end_date).split("-").map(Number);
        dateFilter[Op.lte] = new Date(year, month - 1, day, 23, 59, 59, 999);
      }

      where.start_date = dateFilter;
    }

    let operatorWhere: any = {};
    if (search) {
      operatorWhere = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { surname: { [Op.like]: `%${search}%` } },
          { id_dec: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    const { count, rows: leaves } = await LeaveRecord.findAndCountAll({
      where,
      subQuery: false, // İsim arama (required:true) filtrelemesinin doğru çalışması için şart
      include: [
        {
          model: Operator,
          as: "User",
          where: search ? operatorWhere : undefined,
          required: search ? true : false,
          attributes: ["name", "surname", "id_dec"],
          include: [{ model: Section, attributes: ["name"] }],
        },
        { model: LeaveReason, attributes: ["label"] },
        { model: LeaveStatus, attributes: ["label", "code"] },
        { model: LeaveDurationType, attributes: ["label"] },
        { model: Operator, as: "Approver1", attributes: ["name", "surname"] },
        { model: Operator, as: "Approver2", attributes: ["name", "surname"] },
      ],
      order: [["created_at", "DESC"]],
      limit:
        (is_security === "true" || roleId === 6) && !req.query.limit
          ? undefined
          : Number(limit),
      offset:
        (is_security === "true" || roleId === 6) && !req.query.limit
          ? undefined
          : offset,
      distinct: true,
    });

    const currentLimit =
      (is_security === "true" || roleId === 6) && !req.query.limit
        ? undefined
        : Number(limit);
    const totalPages = currentLimit ? Math.ceil(count / currentLimit) : 1;
    return res.status(200).json({
      data: leaves,
      totalCount: count,
      totalPages,
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("GetLeaves Hatası:", error);
    return res
      .status(500)
      .json({ message: "İzin kayıtları çekilirken hata oluştu." });
  }
};

export const getLeaveActivity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const leave = await LeaveRecord.findByPk(String(req.params.id));
    if (!leave) {
      return res.status(404).json({ message: "İzin kaydı bulunamadı." });
    }

    const loggedUser = req.user;
    const roleId = loggedUser?.role_id;
    const userId = loggedUser?.id_dec;
    const hasBroadAccess = roleId === 7 || roleId === 4 || roleId === 5;
    const canView =
      hasBroadAccess ||
      leave.getDataValue("user_id") === userId ||
      leave.getDataValue("auth1_user_id") === userId ||
      leave.getDataValue("auth2_user_id") === userId;

    if (!canView) {
      return res.status(403).json({ message: "Bu izin kaydının geçmişini görüntüleme yetkiniz yok." });
    }

    const activity = await LeaveActivityLog.findAll({
      where: { leave_record_id: leave.getDataValue("id") },
      include: [
        {
          model: Operator,
          as: "Performer",
          attributes: ["id_dec", "name", "surname"],
          required: false,
        },
        {
          model: Operator,
          as: "Recipient",
          attributes: ["id_dec", "name", "surname", "email"],
          required: false,
        },
        {
          model: LeaveStatus,
          as: "OldStatus",
          attributes: ["id", "label", "code"],
          required: false,
        },
        {
          model: LeaveStatus,
          as: "NewStatus",
          attributes: ["id", "label", "code"],
          required: false,
        },
      ],
      order: [["created_at", "ASC"]],
    });

    const data = activity.map((item) => {
      const activityItem = item.toJSON() as any;
      if (roleId !== 7) {
        activityItem.recipient_address = null;
        activityItem.error_message = null;
        if (activityItem.Recipient) {
          activityItem.Recipient.email = null;
        }
      }
      return activityItem;
    });

    return res.status(200).json({ data });
  } catch (error) {
    console.error("GetLeaveActivity Hatası:", error);
    return res.status(500).json({ message: "İzin geçmişi alınırken bir hata oluştu." });
  }
};

// İzin Onayla
export const approveLeave = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { approver_id, notes } = req.body;

    const leave = await LeaveRecord.findByPk(id as string);
    if (!leave) {
      await transaction.rollback();
      return res.status(404).json({ message: "İzin talebi bulunamadı." });
    }

    let newStatus = 0;
    let actionEnum = "";

    // KİOSK VEYA PANEL KONTROLÜ
    const loggedUser = (req as any).user;
    const loggedRole = loggedUser?.role_id;
    const isAdmin = loggedRole === 7 || loggedRole === 4;

    const currentStatus = leave.getDataValue("leave_status_id") as number;

    if (currentStatus === 1) {
      // ADMIN değilse onaycı kontrolü yap
      if (!isAdmin && leave.getDataValue("auth1_user_id") !== approver_id) {
        await transaction.rollback();
        return res.status(403).json({
          message: "Bu izni onaylama yetkiniz yok (1. Onaycı değilsiniz).",
        });
      }

      const auth1Id = leave.getDataValue("auth1_user_id");
      const auth2Id = leave.getDataValue("auth2_user_id");

      // Eğer 2. onaycı tanımlı değilse VEYA 2. onaycı ile 1. onaycı aynı kişiyse doğrudan TAM ONAY (3)
      const hasValidAuth2 =
        auth2Id && auth2Id !== auth1Id && auth2Id !== "0" && auth2Id !== "";

      newStatus = hasValidAuth2 ? 2 : 3;
      actionEnum = newStatus === 3 ? "APPROVED" : "APPROVED_STEP1";
    } else if (currentStatus === 2) {
      // ADMIN değilse onaycı kontrolü yap
      if (!isAdmin && leave.getDataValue("auth2_user_id") !== approver_id) {
        await transaction.rollback();
        return res.status(403).json({
          message: "Bu izni onaylama yetkiniz yok (2. Onaycı değilsiniz).",
        });
      }
      newStatus = 3;
      actionEnum = "APPROVED";
    } else {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Bu izin talebi şu an onaylanabilir durumda değil." });
    }

    await leave.update({ leave_status_id: newStatus }, { transaction });

    await LeaveActivityLog.create(
      {
        leave_record_id: leave.getDataValue("id"),
        performed_by: approver_id,
        action: actionEnum,
        new_status_id: newStatus,
        details: notes || "İzin onaylandı.",
      },
      { transaction },
    );

    // --- BİLDİRİM TETİKLE ---
    const leaveOwner = await Operator.findByPk(leave.getDataValue("user_id"), {
      transaction,
    });
    if (newStatus === 2 && leave.getDataValue("auth2_user_id")) {
      const auth2Id = leave.getDataValue("auth2_user_id");
      // 2. Onaycıya bildir
      await Notification.create(
        {
          user_id: auth2Id,
          title: "İzin Onay Sırası",
          message: `${leaveOwner?.name} ${leaveOwner?.surname} personelin izni 1. onaydan geçti. Sizin onayınız bekleniyor.`,
          type: "APPROVAL_STEP1",
          related_id: leave.getDataValue("id"),
        },
        { transaction },
      );

      // E-Posta Gönderimi
      try {
        const reasonDoc = await LeaveReason.findByPk(
          leave.getDataValue("leave_reason_id"),
          { transaction },
        );
        if (leaveOwner) {
          await sendLeaveApprovalEmailAndLog({
            leaveId: leave.getDataValue("id"),
            performedBy: approver_id,
            recipientUserId: auth2Id,
            employeeName: `${leaveOwner.name} ${leaveOwner.surname}`,
            startDate: leave.getDataValue("start_date"),
            endDate: leave.getDataValue("end_date"),
            reason: reasonDoc ? reasonDoc.getDataValue("label") : "İzin",
            approvalStage: 2,
            transaction,
          });
        }
      } catch (mailError) {
        console.error("2. Onaycıya e-posta gönderilemedi:", mailError);
      }
    } else if (newStatus === 3) {
      // Personele bildir (Onaylandı)
      await Notification.create(
        {
          user_id: leave.getDataValue("user_id"),
          title: "İzniniz Onaylandı",
          message:
            "İzin talebiniz tüm onay süreçlerinden başarıyla geçerek onaylanmıştır.",
          type: "APPROVED",
          related_id: leave.getDataValue("id"),
        },
        { transaction },
      );
    }

    await transaction.commit();
    return res
      .status(200)
      .json({ message: "İzin başarıyla onaylandı.", data: leave });
  } catch (error) {
    await transaction.rollback();
    console.error("ApproveLeave Error:", error);
    return res.status(500).json({ message: "İzin onaylanırken hata oluştu." });
  }
};

// İzin Reddet
export const rejectLeave = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { approver_id, notes } = req.body;

    // Status 5'in varlığından emin ol (önceden seedlenmemiş DB'ler için güvenli ağ)
    await LeaveStatus.findOrCreate({
      where: { id: 5 },
      defaults: { code: "REJECTED", label: "Reddedildi" },
      transaction,
    });

    const leave = await LeaveRecord.findByPk(id as string);
    if (!leave) {
      await transaction.rollback();
      return res.status(404).json({ message: "İzin talebi bulunamadı." });
    }

    const currentStatus = leave.getDataValue("leave_status_id") as number;
    if (currentStatus !== 1 && currentStatus !== 2) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Bu izin talebi şu an reddedilebilir durumda değil.",
      });
    }

    const loggedUser = (req as any).user;
    const isAdmin = loggedUser?.role_id === 7 || loggedUser?.role_id === 4;

    if (
      !isAdmin &&
      currentStatus === 1 &&
      leave.getDataValue("auth1_user_id") !== approver_id
    ) {
      await transaction.rollback();
      return res.status(403).json({
        message: "Bu izni reddetme yetkiniz yok (1. Onaycı değilsiniz).",
      });
    }

    if (
      !isAdmin &&
      currentStatus === 2 &&
      leave.getDataValue("auth2_user_id") !== approver_id
    ) {
      await transaction.rollback();
      return res.status(403).json({
        message: "Bu izni reddetme yetkiniz yok (2. Onaycı değilsiniz).",
      });
    }

    await leave.update({ leave_status_id: 5 }, { transaction });

    await LeaveActivityLog.create(
      {
        leave_record_id: leave.getDataValue("id"),
        performed_by: approver_id,
        action: "REJECTED",
        new_status_id: 5,
        details: notes || "İzin Yönetici tarafından reddedildi.",
      },
      { transaction },
    );

    // --- BİLDİRİM TETİKLE ---
    await Notification.create(
      {
        user_id: leave.getDataValue("user_id"),
        title: "İzin Talebi Reddedildi",
        message: "İzin talebiniz yönetici tarafından reddedilmiştir.",
        type: "REJECTED",
        related_id: leave.getDataValue("id"),
      },
      { transaction },
    );

    await transaction.commit();
    return res
      .status(200)
      .json({ message: "İzin başarıyla reddedildi.", data: leave });
  } catch (error) {
    await transaction.rollback();
    console.error("RejectLeave Error:", error);
    return res.status(500).json({ message: "İzin reddedilirken hata oluştu." });
  }
};

// İzin İptal Et (Personel Tarafı)
export const cancelLeave = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { user_id } = req.body; // İşlemi yapan kullanıcının ID'si

    const leave = await LeaveRecord.findByPk(id as string);
    if (!leave) {
      await transaction.rollback();
      return res.status(404).json({ message: "İzin talebi bulunamadı." });
    }

    const loggedUser = (req as any).user;
    const roleId = loggedUser?.role_id;
    const isAdminOrRevir = roleId === 7 || roleId === 4 || roleId === 5; // Admin, İK, Revir

    const isOwner = leave.getDataValue("user_id") === user_id;

    // 1. Sadece sahibi VEYA Yetkili (Admin/Revir/İK) iptal edebilir
    if (!isOwner && !isAdminOrRevir) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ message: "Bu izin talebini iptal etme yetkiniz yok." });
    }

    const currentStatus = leave.getDataValue("leave_status_id") as number;
    const isAutoApprovedWithoutChain =
      currentStatus === 3 &&
      !leave.getDataValue("auth1_user_id") &&
      !leave.getDataValue("auth2_user_id");

    // 2. Zaten bitmiş/iptal edilmiş süreçler
    if (currentStatus === 4 || currentStatus === 5) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Bu izin talebi zaten bitmiş veya iptal edilmiş." });
    }

    // 3. Normal personel bekleyenleri (1,2) ve sadece otomatik onaylanmış zincirsiz kendi iznini iptal edebilir.
    // Yetkililer ise onaylanmışı (3) da iptal edebilir.
    if (!isAdminOrRevir && currentStatus !== 1 && currentStatus !== 2 && !(isOwner && isAutoApprovedWithoutChain)) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "Onaylanmış izin talepleri departman yöneticisi veya revir olmadan iptal edilemez.",
      });
    }

    await leave.update(
      {
        leave_status_id: 4,
        cancelled_at: new Date(),
        cancelled_by: user_id,
      },
      { transaction },
    ); // Status 4 = CANCELLED

    await LeaveActivityLog.create(
      {
        leave_record_id: leave.getDataValue("id"),
        performed_by: user_id,
        action:
          isAdminOrRevir && leave.getDataValue("user_id") !== user_id
            ? "CANCELLED_BY_ADMIN"
            : "CANCELLED_BY_USER",
        new_status_id: 4,
        details:
          isAdminOrRevir && leave.getDataValue("user_id") !== user_id
            ? "Yetkili personel (Revir/Admin/İK) tarafından iptal edildi."
            : "Kullanıcı talebi tarafından iptal edildi.",
      },
      { transaction },
    );

    await transaction.commit();
    return res
      .status(200)
      .json({ message: "İzin talebi başarıyla iptal edildi.", data: leave });
  } catch (error) {
    await transaction.rollback();
    console.error("CancelLeave Error:", error);
    return res
      .status(500)
      .json({ message: "İzin iptal edilirken hata oluştu." });
  }
};

// İzin Talebi Güncelle (Düzenle)
export const updateLeave = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { user_id, ...updateData } = req.body;

    const leave = await LeaveRecord.findByPk(id as string);
    if (!leave) {
      await transaction.rollback();
      return res.status(404).json({ message: "İzin talebi bulunamadı." });
    }

    const loggedUser = (req as any).user;
    const roleId = loggedUser?.role_id;
    const isAdminOrRevir = roleId === 7 || roleId === 4 || roleId === 5;

    // 1. Sadece sahibi VEYA Yetkili (Admin/Revir/İK) değiştirebilir
    if (leave.getDataValue("user_id") !== user_id && !isAdminOrRevir) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ message: "Bu izin talebini düzenleme yetkiniz yok." });
    }

    // 2. Sadece bekleyen (1 veya 2) durumdakiler düzenlenebilir (Yetkililer hariç)
    const currentStatus = leave.getDataValue("leave_status_id") as number;
    if (currentStatus !== 1 && currentStatus !== 2 && !isAdminOrRevir) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Sadece onay bekleyen izin talepleri düzenlenebilir.",
      });
    }

    // GÜNCELLEME İÇİN ÇAKIŞMA KONTROLÜ
    const overlappingLeave = await LeaveRecord.findOne({
      where: {
        id: { [Op.ne]: id }, // Kendisi hariç
        user_id: leave.getDataValue("user_id"),
        leave_status_id: { [Op.notIn]: [4, 5] },
        [Op.or]: [
          {
            start_date: {
              [Op.lte]: updateData.end_date || leave.getDataValue("end_date"),
            },
            end_date: {
              [Op.gte]:
                updateData.start_date || leave.getDataValue("start_date"),
            },
          },
        ],
      },
      transaction,
    });

    if (overlappingLeave) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "Güncellenen tarih aralığı başka bir aktif/bekleyen talebinizle çakışmaktadır.",
      });
    }

    // 3. Güncellemeyi yap
    await leave.update(updateData, { transaction });

    await LeaveActivityLog.create(
      {
        leave_record_id: leave.getDataValue("id"),
        performed_by: user_id,
        action: "UPDATED_BY_USER",
        new_status_id: currentStatus,
        details: "İzin talebi kullanıcı tarafından güncellendi.",
      },
      { transaction },
    );

    await transaction.commit();
    return res
      .status(200)
      .json({ message: "İzin talebi başarıyla güncellendi.", data: leave });
  } catch (error) {
    await transaction.rollback();
    console.error("UpdateLeave Error:", error);
    return res
      .status(500)
      .json({ message: "İzin güncellenirken hata oluştu." });
  }
};

// Güvenlik: Personel Çıkış Onayı
export const confirmExit = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { id } = req.params;
  const { confirmed_by } = req.body;

  try {
    const leave = await LeaveRecord.findByPk(Number(id));
    if (!leave)
      return res.status(404).json({ message: "İzin talebi bulunamadı." });

    // Sadece onaylanmış izinler çıkış yapabilir
    if (leave.getDataValue("leave_status_id") !== 3) {
      return res.status(400).json({
        message: "Sadece onaylanmış izin taleplerinin çıkışı onaylanabilir.",
      });
    }

    await leave.update({
      exit_confirmed_at: fn("GETDATE"),
      exit_confirmed_by: confirmed_by,
    });

    await LeaveActivityLog.create({
      leave_record_id: leave.getDataValue("id"),
      performed_by: confirmed_by,
      action: "EXIT_CONFIRMED",
      new_status_id: 3,
      details: "Bekçi tarafından çıkış onaylandı.",
    });

    return res.status(200).json({ message: "Çıkış onaylandı.", data: leave });
  } catch (error: any) {
    console.error("ConfirmExit Error:", error);
    return res.status(500).json({
      message: `Çıkış onayı başarısız: ${error.message || "Bilinmeyen SQL hatası"}`,
    });
  }
};

// E-posta üzerinden gelen onay/red talebini işle
export const handleEmailAction = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  const transaction = await sequelize.transaction();
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      await transaction.rollback();
      return res
        .status(400)
        .send("Geçersiz veya eksik token. Lütfen maildeki linki kontrol edin.");
    }

    let decoded: EmailActionPayload;
    try {
      decoded = jwt.verify(
        token,
        process.env.SECRET_KEY || "super_secret_jwt_key_degistir",
      ) as EmailActionPayload;
    } catch (err) {
      await transaction.rollback();
      return res.status(401).send("Token geçersiz veya çözülemedi.");
    }

    const { leave_id, approver_id, action } = decoded;

    if (!leave_id || !approver_id || !action) {
      await transaction.rollback();
      return res.status(400).send("Token eksik bilgi içeriyor.");
    }

    const leave = await LeaveRecord.findByPk(leave_id);
    if (!leave) {
      await transaction.rollback();
      return res.status(404).send("İzin talebi bulunamadı.");
    }

    const currentStatus = leave.getDataValue("leave_status_id") as number;
    if (currentStatus !== 1 && currentStatus !== 2) {
      await transaction.rollback();
      return res.send(
        "<div style='font-family: sans-serif; text-align: center; padding: 40px;'><h3>Bu izin talebi zaten onaylanmış, reddedilmiş veya iptal edilmiş.</h3><p>İlginiz için teşekkürler.</p></div>",
      );
    }

    // Onaycı kontrolü
    if (
      currentStatus === 1 &&
      leave.getDataValue("auth1_user_id") !== approver_id
    ) {
      await transaction.rollback();
      return res
        .status(403)
        .send(
          "<div style='font-family: sans-serif; text-align: center; padding: 40px;'><h3>Bu iznin şu anki aşamasındaki onaycısı siz değilsiniz.</h3></div>",
        );
    }
    if (
      currentStatus === 2 &&
      leave.getDataValue("auth2_user_id") !== approver_id
    ) {
      await transaction.rollback();
      return res
        .status(403)
        .send(
          "<div style='font-family: sans-serif; text-align: center; padding: 40px;'><h3>Bu iznin şu anki aşamasındaki onaycısı siz değilsiniz.</h3></div>",
        );
    }

    // Aksiyon: ONAY
    if (action === "approve") {
      const auth1Id = leave.getDataValue("auth1_user_id");
      const auth2Id = leave.getDataValue("auth2_user_id");
      let newStatus = 0;
      let actionEnum = "";

      if (currentStatus === 1) {
        const hasValidAuth2 =
          auth2Id && auth2Id !== auth1Id && auth2Id !== "0" && auth2Id !== "";
        newStatus = hasValidAuth2 ? 2 : 3;
        actionEnum = newStatus === 3 ? "APPROVED" : "APPROVED_STEP1";
      } else {
        newStatus = 3;
        actionEnum = "APPROVED";
      }

      await leave.update({ leave_status_id: newStatus }, { transaction });

      await LeaveActivityLog.create(
        {
          leave_record_id: leave_id,
          performed_by: approver_id,
          action: actionEnum,
          new_status_id: newStatus,
          details: "E-posta üzerinden onaylandı.",
        },
        { transaction },
      );

      // Bildirim ve Mail tetikleyici
      const leaveOwner = await Operator.findByPk(
        leave.getDataValue("user_id"),
        { transaction },
      );
      if (newStatus === 2 && auth2Id) {
        await Notification.create(
          {
            user_id: auth2Id,
            title: "İzin Onay Sırası",
            message: `${leaveOwner?.name} ${leaveOwner?.surname} personelin izni 1. onaydan geçti. Sizin onayınız bekleniyor.`,
            type: "APPROVAL_STEP1",
            related_id: leave_id,
          },
          { transaction },
        );

        try {
          const reasonDoc = await LeaveReason.findByPk(
            leave.getDataValue("leave_reason_id"),
            { transaction },
          );
          if (leaveOwner) {
            await sendLeaveApprovalEmailAndLog({
              leaveId: leave_id,
              performedBy: approver_id,
              recipientUserId: auth2Id,
              employeeName: `${leaveOwner.name} ${leaveOwner.surname}`,
              startDate: leave.getDataValue("start_date"),
              endDate: leave.getDataValue("end_date"),
              reason: reasonDoc ? reasonDoc.getDataValue("label") : "İzin",
              approvalStage: 2,
              transaction,
            });
          }
        } catch (mailError) {
          console.error("2. Onaycı mail hatası", mailError);
        }
      } else if (newStatus === 3) {
        await Notification.create(
          {
            user_id: leave.getDataValue("user_id"),
            title: "İzniniz Onaylandı",
            message:
              "İzin talebiniz tüm onay süreçlerinden başarıyla geçerek onaylanmıştır.",
            type: "APPROVED",
            related_id: leave_id,
          },
          { transaction },
        );
      }

      await transaction.commit();
      return res.send(
        "<div style='font-family: sans-serif; text-align: center; padding: 40px;'><h2 style='color:green;'>İzin başarıyla onaylandı!</h2><p>Gerekli işlemler gerçekleştirildi. Bu ekranı kapatabilirsiniz.</p></div>",
      );
    }
    // Aksiyon: RED
    else if (action === "reject") {
      await LeaveStatus.findOrCreate({
        where: { id: 5 },
        defaults: { code: "REJECTED", label: "Reddedildi" },
        transaction,
      });

      await leave.update({ leave_status_id: 5 }, { transaction });

      await LeaveActivityLog.create(
        {
          leave_record_id: leave_id,
          performed_by: approver_id,
          action: "REJECTED",
          new_status_id: 5,
          details: "E-posta üzerinden reddedildi.",
        },
        { transaction },
      );

      await Notification.create(
        {
          user_id: leave.getDataValue("user_id"),
          title: "İzin Talebi Reddedildi",
          message: "İzin talebiniz yönetici tarafından reddedilmiştir.",
          type: "REJECTED",
          related_id: leave_id,
        },
        { transaction },
      );

      await transaction.commit();
      return res.send(
        "<div style='font-family: sans-serif; text-align: center; padding: 40px;'><h2 style='color:red;'>İzin isteği reddedildi!</h2><p>Gerekli bildirimler personele sistem üzerinden yapıldı. Bu ekranı kapatabilirsiniz.</p></div>",
      );
    } else {
      await transaction.rollback();
      return res.status(400).send("Geçersiz işlem tipi.");
    }
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Email Action Error:", error);
    return res.status(500).send("İşlem sırasında bir hata oluştu.");
  }
};


// --- İzin & Devamsızlık Süreç Analitiği (KPIs & Raporlama) ---
export const getLeaveKPIs = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { startDate, endDate, sectionId, sectionIds, reasonCategory, reasonIds } = req.query;

    const where: any = {};

    // Tarih Aralığı Filtresi (start_date bazlı)
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        const [y, m, d] = String(startDate).split("-").map(Number);
        dateFilter[Op.gte] = new Date(y, m - 1, d, 0, 0, 0, 0);
      }
      if (endDate) {
        const [y, m, d] = String(endDate).split("-").map(Number);
        dateFilter[Op.lte] = new Date(y, m - 1, d, 23, 59, 59, 999);
      }
      where.start_date = dateFilter;
    }

    // Neden Filtresi (İzin Nedenleri Dağılımı listesinin teke düşmemesi için sorgu sonrası filtrelenir)
    let allowedReasonIds: number[] | null = null;
    if (reasonIds) {
      if (reasonIds === "-1" || reasonIds === "NONE") {
        allowedReasonIds = [];
      } else {
        const rIds = String(reasonIds)
          .split(",")
          .map(Number)
          .filter((n) => !isNaN(n));
        if (rIds.length > 0) allowedReasonIds = rIds;
      }
    } else if (reasonCategory === "REVIR") {
      allowedReasonIds = [8, 9];
    } else if (reasonCategory === "ANNUAL") {
      allowedReasonIds = [1];
    } else if (reasonCategory === "SICK") {
      allowedReasonIds = [2];
    } else if (reasonCategory && reasonCategory !== "ALL") {
      const numericReason = Number(reasonCategory);
      if (!isNaN(numericReason)) allowedReasonIds = [numericReason];
    }

    // Bölüm Filtresi (Bölüm Dağılımı listesinin teke düşmemesi için sorgu sonrası filtrelenir)
    let allowedSectionIds: string[] | null = null;
    const sParam = sectionIds || sectionId;
    if (sParam && sParam !== "ALL") {
      if (sParam === "NONE" || sParam === "-1") {
        allowedSectionIds = [];
      } else {
        const sIds = String(sParam)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (sIds.length > 0) allowedSectionIds = sIds;
      }
    }

    // Kayıtları Çek
    const records = await LeaveRecord.findAll({
      where,
      include: [
        {
          model: Operator,
          as: "User",
          required: false,
          attributes: ["id_dec", "name", "surname", "section", "department"],
          include: [
            { model: Section, attributes: ["id", "name"] },
            { model: Department, attributes: ["id", "name"] }
          ]
        },
        { model: LeaveReason, attributes: ["id", "code", "label"] },
        { model: LeaveStatus, attributes: ["id", "code", "label"] },
        { model: LeaveDurationType, attributes: ["id", "code", "label"] }
      ],
      order: [["start_date", "DESC"]]
    });

    // Lookup seçeneklerini al (Filtre açılır kutuları için)
    const [allSections, allReasons] = await Promise.all([
      Section.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]] }),
      LeaveReason.findAll({ where: { is_active: true }, attributes: ["id", "code", "label"], order: [["label", "ASC"]] })
    ]);

    // Dinamik Gün & Saat Hesaplayıcı
    const calculateDuration = (r: any) => {
      let days = Number(r.total_days || 0);
      let hours = Number(r.total_hours || 0);

      if (days === 0 && r.start_date && r.end_date) {
        const s = new Date(r.start_date);
        const e = new Date(r.end_date);
        const diffMs = Math.max(0, e.getTime() - s.getTime());
        const diffHours = diffMs / (1000 * 60 * 60);

        if (r.leave_duration_type_id === 4) {
          hours = Math.round(diffHours * 10) / 10;
          days = Math.round((hours / 9) * 10) / 10;
        } else if (r.leave_duration_type_id === 2 || r.leave_duration_type_id === 3) {
          days = 0.5;
          hours = 4.5;
        } else {
          const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
          const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());
          const dayCount = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          days = Math.max(1, dayCount);
          hours = days * 9;
        }
      }

      return {
        days: Math.round(days * 10) / 10,
        hours: Math.round(hours * 10) / 10
      };
    };

    const now = new Date();
    let currentlyOnLeave = 0;
    let totalRequests = 0;
    let totalDays = 0;
    let totalHours = 0;

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let cancelledCount = 0;

    let totalApprovalDurationHours = 0;
    let approvalDurationCount = 0;

    let revirTotal = 0;
    let revirSevkCount = 0;
    let revirIstirahatCount = 0;
    let revirLostHours = 0;

    // Reason aggregation map: Tarih ve bölüm filtresindeki TÜM kayıtları içerir (Böylece dağılım asla teke düşmez!)
    const reasonMap = new Map<number, { label: string; code: string; count: number; days: number; hours: number }>();
    for (const ar of allReasons) {
      const p = (ar as any).get ? (ar as any).get({ plain: true }) : ar;
      reasonMap.set(p.id, { label: p.label, code: p.code, count: 0, days: 0, hours: 0 });
    }

    // Section aggregation map: 23 fabrikanın tüm bölümlerini içerir (3x3 grid asla teke düşmez!)
    const sectionMap = new Map<string, { id: any; name: string; total: number; approved: number; revir: number; days: number; hours: number }>();
    for (const sec of allSections) {
      const p = (sec as any).get ? (sec as any).get({ plain: true }) : sec;
      const sId = String(p.id);
      sectionMap.set(sId, { id: p.id, name: p.name, total: 0, approved: 0, revir: 0, days: 0, hours: 0 });
    }

    const monthlyMap = new Map<string, { month: string; label: string; total: number; revir: number; approved: number }>();
    const matchingRecords: any[] = [];
    const totalScopeRequests = records.length;

    for (const rec of records) {
      const r = rec.get({ plain: true });
      const { days, hours } = calculateDuration(r);
      const reasonId = Number(r.leave_reason_id);
      const userSecId = r.User?.Section?.id != null ? String(r.User.Section.id) : (r.User?.section != null ? String(r.User.section) : null);
      const secId = userSecId || "UNKNOWN";
      const secName = r.User?.Section?.name || (userSecId ? `Bölüm #${userSecId}` : "Bölüm Belirtilmemiş");
      const statusId = Number(r.leave_status_id);
      const isRevir = reasonId === 8 || reasonId === 9;

      // 1. Bölüm Dağılımı Hesaplama:
      // Seçilen İzin Nedenleri (varsa) filtrelenir, ancak bölüm filtresinden bağımsız olarak TÜM bölümler görünür kalır.
      const matchesReason = allowedReasonIds === null || allowedReasonIds.includes(reasonId);
      if (matchesReason) {
        if (!sectionMap.has(secId)) {
          sectionMap.set(secId, { id: userSecId || secId, name: secName, total: 0, approved: 0, revir: 0, days: 0, hours: 0 });
        }
        const sEntry = sectionMap.get(secId)!;
        sEntry.total++;
        if (statusId === 3) sEntry.approved++;
        if (isRevir) sEntry.revir++;
        sEntry.days += days;
        sEntry.hours += hours;
      }

      // 2. Neden Dağılımı Hesaplama:
      // Seçilen Bölümler (varsa) filtrelenir, ancak tüm nedenler görünür kalır.
      const matchesSection = allowedSectionIds === null || (userSecId != null && allowedSectionIds.includes(userSecId));
      if (matchesSection) {
        const reasonLabel = r.LeaveReason?.label || ("Neden #" + reasonId);
        const reasonCode = r.LeaveReason?.code || "";
        if (!reasonMap.has(reasonId)) {
          reasonMap.set(reasonId, { label: reasonLabel, code: reasonCode, count: 0, days: 0, hours: 0 });
        }
        const rEntry = reasonMap.get(reasonId)!;
        rEntry.count++;
        rEntry.days += days;
        rEntry.hours += hours;
      }

      // 3. Genel KPI'lar, Trend ve Tablo Kayıtları:
      // Hem seçilen neden(ler)e hem de seçilen bölüm(ler)e uyan kayıtlar dahil edilir.
      if (!matchesReason || !matchesSection) {
        continue;
      }

      totalRequests++;
      totalDays += days;
      totalHours += hours;

      if (statusId === 1 || statusId === 2) pendingCount++;
      else if (statusId === 3) approvedCount++;
      else if (statusId === 4) cancelledCount++;
      else if (statusId === 5) rejectedCount++;

      // Şu an aktif izinli mi?
      if (statusId === 3 && r.start_date && r.end_date) {
        const sDate = new Date(r.start_date);
        const eDate = new Date(r.end_date);
        if (sDate <= now && eDate >= now) {
          currentlyOnLeave++;
        }
      }

      // Ortalama onay süresi (Oluşturma -> 1. Onay yanıtı)
      if (r.auth1_responded_at && r.created_at) {
        const diffMs = new Date(r.auth1_responded_at).getTime() - new Date(r.created_at).getTime();
        if (diffMs > 0) {
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours < 24 * 365) {
            totalApprovalDurationHours += diffHours;
            approvalDurationCount++;
          }
        }
      }

      // Revir Kontrolü (8: Doktor Sevk, 9: Doktor İstirahat)
      if (isRevir) {
        revirTotal++;
        if (reasonId === 8) revirSevkCount++;
        if (reasonId === 9) revirIstirahatCount++;
        revirLostHours += hours;
      }

      // Aylık Trend
      if (r.start_date) {
        const d = new Date(r.start_date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const monthKey = yyyy + "-" + mm;
        if (!monthlyMap.has(monthKey)) {
          const monthName = d.toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
          monthlyMap.set(monthKey, { month: monthKey, label: monthName, total: 0, revir: 0, approved: 0 });
        }
        const mEntry = monthlyMap.get(monthKey)!;
        mEntry.total++;
        if (isRevir) mEntry.revir++;
        if (statusId === 3) mEntry.approved++;
      }

      matchingRecords.push({ r, duration: { days, hours } });
    }

    const approvalRate = (approvedCount + rejectedCount) > 0 
      ? Math.round((approvedCount / (approvedCount + rejectedCount)) * 1000) / 10 
      : 100;

    const avgApprovalHours = approvalDurationCount > 0 
      ? Math.round((totalApprovalDurationHours / approvalDurationCount) * 10) / 10 
      : 0;

    const revirSharePercentage = totalRequests > 0 
      ? Math.round((revirTotal / totalRequests) * 1000) / 10 
      : 0;

    const totalReasonScopeRequests = Array.from(reasonMap.values()).reduce((sum, v) => sum + v.count, 0);

    const byReason = Array.from(reasonMap.entries())
      .map(([id, val]) => ({
        id,
        code: val.code,
        label: val.label,
        count: val.count,
        totalDays: Math.round(val.days * 10) / 10,
        totalHours: Math.round(val.hours * 10) / 10,
        percentage: totalReasonScopeRequests > 0 ? Math.round((val.count / totalReasonScopeRequests) * 1000) / 10 : 0
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label, "tr");
      });

    const bySection = Array.from(sectionMap.values())
      .map((val) => ({
        ...val,
        days: Math.round(val.days * 10) / 10,
        hours: Math.round(val.hours * 10) / 10
      }))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name, "tr");
      });

    const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    const tableRecords = matchingRecords.slice(0, 300).map(({ r, duration }) => {
      return {
        id: r.id,
        userId: r.user_id,
        employeeName: r.User ? (r.User.name + " " + r.User.surname) : ("ID: " + r.user_id),
        sectionName: r.User?.Section?.name || "-",
        departmentName: r.User?.Department?.name || "-",
        reasonId: r.leave_reason_id,
        reasonLabel: r.LeaveReason?.label || "-",
        statusId: r.leave_status_id,
        statusLabel: r.LeaveStatus?.label || "-",
        statusCode: r.LeaveStatus?.code || "-",
        durationType: r.LeaveDurationType?.label || "Tam Gün",
        startDate: r.start_date,
        endDate: r.end_date,
        totalDays: r.total_days ?? duration.days,
        totalHours: r.total_hours ?? duration.hours,
        description: r.description,
        createdAt: r.created_at,
        respondedAt: r.auth1_responded_at
      };
    });

    // Bugün aktif izinli personeller (start_date <= now ve end_date >= now ve status = 3 Onaylandı)
    const activeLeavesRecords = await LeaveRecord.findAll({
      where: {
        leave_status_id: 3,
        start_date: { [Op.lte]: now },
        end_date: { [Op.gte]: now }
      },
      include: [
        {
          model: Operator,
          as: "User",
          required: false,
          attributes: ["id_dec", "name", "surname", "section", "department", "email"],
          include: [
            { model: Section, attributes: ["id", "name"] },
            { model: Department, attributes: ["id", "name"] }
          ]
        },
        { model: LeaveReason, attributes: ["id", "code", "label"] },
        { model: LeaveDurationType, attributes: ["id", "code", "label"] }
      ],
      order: [["end_date", "ASC"]]
    });

    const activeLeaves = activeLeavesRecords
      .map((rec: any) => {
        const r = rec.get({ plain: true });
        const reasonId = Number(r.leave_reason_id);
        const userSecId = r.User?.Section?.id != null ? String(r.User.Section.id) : (r.User?.section != null ? String(r.User.section) : null);
        const duration = calculateDuration(r);
        return {
          id: r.id,
          userId: r.user_id,
          employeeName: r.User ? (r.User.name + " " + r.User.surname) : ("ID: " + r.user_id),
          sectionId: userSecId,
          sectionName: r.User?.Section?.name || (userSecId ? `Bölüm #${userSecId}` : "Bölüm Belirtilmemiş"),
          departmentName: r.User?.Department?.name || "-",
          reasonId,
          reasonLabel: r.LeaveReason?.label || "-",
          durationType: r.LeaveDurationType?.label || "Tam Gün",
          startDate: r.start_date,
          endDate: r.end_date,
          totalDays: r.total_days ?? duration.days,
          totalHours: r.total_hours ?? duration.hours,
          description: r.description,
          email: r.User?.email,
          isRevir: reasonId === 8 || reasonId === 9
        };
      })
      .filter((item: any) => {
        if (allowedReasonIds !== null && !allowedReasonIds.includes(item.reasonId)) return false;
        if (allowedSectionIds !== null && item.sectionId != null && !allowedSectionIds.includes(item.sectionId)) return false;
        return true;
      });

    // Onay bekleyen talepler (statusId = 1: 1. Onay Bekliyor, statusId = 2: 2. Onay Bekliyor)
    const pendingLeaves = matchingRecords
      .filter(({ r }) => Number(r.leave_status_id) === 1 || Number(r.leave_status_id) === 2)
      .map(({ r, duration }) => {
        const reasonId = Number(r.leave_reason_id);
        const userSecId = r.User?.Section?.id != null ? String(r.User.Section.id) : (r.User?.section != null ? String(r.User.section) : null);
        const statusId = Number(r.leave_status_id);
        return {
          id: r.id,
          userId: r.user_id,
          employeeName: r.User ? (r.User.name + " " + r.User.surname) : ("ID: " + r.user_id),
          sectionId: userSecId,
          sectionName: r.User?.Section?.name || (userSecId ? `Bölüm #${userSecId}` : "Bölüm Belirtilmemiş"),
          departmentName: r.User?.Department?.name || "-",
          reasonId,
          reasonLabel: r.LeaveReason?.label || "-",
          statusId,
          statusLabel: r.LeaveStatus?.label || (statusId === 1 ? "1. Onay Bekliyor" : "2. Onay Bekliyor"),
          statusCode: r.LeaveStatus?.code || (statusId === 1 ? "PENDING_AUTH1" : "PENDING_AUTH2"),
          durationType: r.LeaveDurationType?.label || "Tam Gün",
          startDate: r.start_date,
          endDate: r.end_date,
          totalDays: r.total_days ?? duration.days,
          totalHours: r.total_hours ?? duration.hours,
          description: r.description,
          createdAt: r.created_at,
          auth1UserId: r.auth1_user_id,
          auth2UserId: r.auth2_user_id,
          isRevir: reasonId === 8 || reasonId === 9
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return res.json({
      summary: {
        totalRequests,
        totalDays: Math.round(totalDays * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        currentlyOnLeave: activeLeaves.length,
        pendingCount,
        approvedCount,
        rejectedCount,
        cancelledCount,
        approvalRate,
        avgApprovalHours,
        revir: {
          total: revirTotal,
          sevkCount: revirSevkCount,
          istirahatCount: revirIstirahatCount,
          lostHours: Math.round(revirLostHours * 10) / 10,
          sharePercentage: revirSharePercentage
        }
      },
      activeLeaves,
      pendingLeaves,
      byReason,
      bySection,
      monthlyTrend,
      records: tableRecords,
      filterOptions: {
        sections: allSections,
        reasons: allReasons
      }
    });
  } catch (error) {
    console.error("GetLeaveKPIs Error:", error);
    return res.status(500).json({ message: "İzin KPI verileri hesaplanırken hata oluştu." });
  }
};

/**
 * İzin Analitikleri Sayfası Denetim Kaydı (Audit Log)
 * Excel indirme, Şu an izinliler açılır yan paneli ve Onay bekleyenler açılır yan paneli gibi ekran hareketlerini loglar.
 */
export const logLeaveKPIAudit = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { actionType, description, screen, actionData } = req.body;
    if (!actionType) {
      return res.status(400).json({ success: false, message: "actionType parametresi zorunludur." });
    }

    await writeAuditLog({
      req,
      module: "LEAVE_ANALYTICS",
      actionType: String(actionType).trim().toUpperCase(),
      description: description || `İzin analitiği işlem: ${actionType}`,
      details: {
        screen: screen || {
          pageTitle: "İzin ve Revir Analitik Paneli",
          route: "/reports/leave-kpis",
          component: "MAIN_DASHBOARD",
        },
        actionData: actionData || {},
      },
    });

    return res.status(200).json({ success: true, message: "Denetim kaydı başarıyla oluşturuldu." });
  } catch (error: any) {
    console.error("[logLeaveKPIAudit Hatası]:", error);
    return res.status(500).json({ success: false, message: "Denetim kaydı kaydedilirken hata oluştu." });
  }
};
